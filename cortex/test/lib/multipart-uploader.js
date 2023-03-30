const { privatesAccessor } = require('../../lib/classes/privates'),
      { Transform } = require('stream'),
      https = require('https'),
      { URL } = require('url'),
      _ = require('underscore'),
      aws4 = require('aws4'),
      xml2js = require('xml2js'),
      server = require('../../test/lib/server')

class S3MultipartUpload {

  constructor(accessKeyId, secretAccessKey, uploadUrl, formFields = {}) {
    Object.assign(privatesAccessor(this), {
      maxNumberOfTries: 3,
      accessKeyId,
      secretAccessKey,
      uploadUrl,
      formFields,
      partSize: 1024 * 1024 * 5,
      multipartMap: {
        Part: []
      }
    })
  }

  async parseXml(data) {
    return new Promise((resolve, reject) => {
      const parser = new xml2js.Parser()
      if (!data) {
        resolve({})
      }
      parser.parseString(data, (err, result) => {
        if (err) return reject(err)
        return resolve(result)
      })
    })
  }

  async parseJson(json) {
    return new Promise((resolve) => {
      const builder = new xml2js.Builder()
      if (!json) {
        resolve('')
      }
      resolve(builder.buildObject(json, {
        headless: true
      }))
    })
  }

  async uploadChunk(buffer, partNum) {
    const uploadId = await this.initMultipartUpload(),
          chunkData = Buffer.concat(buffer)
    return this.uploadPart(uploadId, chunkData, partNum)
  }

  async upload(stream) {
    let partNum = 1,
        buffer = [],
        bufferSize = 0
    const self = this,
          { multipartMap, partSize } = privatesAccessor(self),
          initTime = process.hrtime(),
          streamChunk = new Transform({
            readableHighWaterMark: partSize,
            writableHighWaterMark: partSize,
            async write(chunk, enc, cb) {
              buffer.push(chunk)
              bufferSize += chunk.length
              if (bufferSize >= partSize) {
                self.uploadChunk(buffer, partNum).then(() => {
                  partNum += 1
                  buffer = []
                  bufferSize = 0
                  cb()
                }).catch(e => cb(e))
              } else {
                cb()
              }
            },
            async final() {
              let { uploadId } = privatesAccessor(self)
              if (!uploadId) {
                // minimum buffer length not reached, send only one part
                await self.uploadChunk(buffer, 1)
                uploadId = privatesAccessor(self).uploadId
              }
              multipartMap.Part = await self.getParts(uploadId)
              return self.completeUpload(uploadId, initTime)
            }
          }).on('error', (e) => {
            console.log(e)
            const { uploadId } = privatesAccessor(self)
            self.abortUpload(uploadId)
          })
    stream.pipe(streamChunk)
  }

  signRequest(data, options = {}) {
    const { accessKeyId, secretAccessKey, formFields, uploadUrl } = privatesAccessor(this),
          { host } = new URL(uploadUrl),
          toSign = Object.assign({
            method: options.method || 'POST',
            host,
            region: 'us-east-1',
            path: `/${formFields.key}${options.query || ''}`,
            service: 's3',
            headers: options.headers || {}
          }, data),
          params = aws4.sign(toSign, { accessKeyId, secretAccessKey })
    privatesAccessor(this, 'auth', params.headers.Authorization)
    console.log('AUTH', params.headers.Authorization)
    return params
  }

  call(o, options = {}) {
    return new Promise((resolve, reject) => {
      const params = this.signRequest(o, options)
      https.request(params, (res) => {
        const body = []
        res.on('data', (c) => {
          body.push(c)
        }).on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            this.parseXml(Buffer.concat(body).toString()).then((json) => {
              resolve(json)
            }).catch(e => reject(e))
          } else {
            console.log(body.toString())
            reject(new Error(res.statusMessage))
          }
        })
      })
        .on('error', (e) => {
          reject(e)
        }).end(o.body || '')
    })
  }

  async initMultipartUpload() {
    const { uploadId, formFields } = privatesAccessor(this)
    if (!uploadId) {
      return new Promise((resolve, reject) => {
        this.call({}, {
          query: '?uploads',
          headers: {
            success_action_status: formFields.success_action_status || 201,
            'x-amz-server-side-encryption': formFields['x-amz-server-side-encryption'],
            'Content-Type': formFields['content-type'] || 'application/octet-stream',
            'x-amz-meta-__mocha_test_uuid__': server.__mocha_test_uuid__,
            'x-amz-meta-mochaCurrentTestUuid': server.mochaCurrentTestUuid
          }
        }).then((res) => {
          if (res.InitiateMultipartUploadResult.UploadId) {
            privatesAccessor(this, 'uploadId', res.InitiateMultipartUploadResult.UploadId[0])
            resolve(res.InitiateMultipartUploadResult.UploadId[0])
          } else {
            reject(res)
          }
        }).catch(reject)
      })
    }
    return Promise.resolve(uploadId)

  }

  async uploadPart(uploadId, buffer, partNumber, tryNum = 1) {
    const {
            maxNumberOfTries
          } = privatesAccessor(this),
          partParams = {
            body: buffer
          }
    return new Promise((resolve, reject) => {
      this.call(partParams, { query: `?partNumber=${partNumber}&uploadId=${uploadId}`, method: 'PUT' }).then((res) => {
        console.log(res)
        resolve({
          ETag: res.ETag,
          PartNumber: res.PartNumber
        })
      }).catch((e) => {
        if (tryNum < maxNumberOfTries) {
          /* eslint-disable no-param-reassign */
          tryNum += 1
          return this.uploadPart(uploadId, buffer, partNumber, tryNum)
        }
        return reject(e)
      })
    })

  }

  async getParts(uploadId) {
    return new Promise((resolve, reject) => {
      this.call({}, { query: `?uploadId=${uploadId}`, method: 'GET' }).then((res) => {
        const parts = res.ListPartsResult.Part,
              data = _.map(parts, p => ({ PartNumber: p.PartNumber, ETag: p.ETag }))
        resolve(data)
      }).catch(e => reject(e))
    })
  }

  async completeUpload(uploadId, startTime) {
    const {
            multipartMap
          } = privatesAccessor(this),
          doneParams = {
            body: await this.parseJson({ CompleteMultipartUpload: multipartMap }),
            headers: {
              'Content-Type': 'text/xml'
            }
          }
    return this.call(doneParams, {
      query: `?uploadId=${uploadId}`
    }).then((res) => {
      privatesAccessor(this, 'uploadId', null)
      console.log(res, startTime)
    }).catch((e) => {
      console.log(e)
      this.abortUpload(uploadId)
    })
  }

  async abortUpload(uploadId) {
    return this.call({}, { query: `?uploadId=${uploadId}`, method: 'DELETE' }).then(() => {
      privatesAccessor(this, 'uploadId', null)
    }).catch(e => console.log(e))
  }

}

module.exports = S3MultipartUpload
