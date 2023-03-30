
const S3 = require('s3rver'),
      path = require('path'),
      fs = require('fs'),
      mkdirp = require('mkdirp'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      filesRoot = config('test.s3rver.filesRoot'),
      rm = require('rimraf').sync,
      instance = new S3({
        port: config('test.s3rver.port'),
        hostname: config('test.s3rver.host'),
        silent: false,
        key: fs.readFileSync(path.join(__dirname, 'server.key')),
        cert: fs.readFileSync(path.join(__dirname, 'server.cert')),
        configureBuckets: [
          {
            name: config('test.s3rver.bucket'),
            configs: [`
              <CORSConfiguration>
                <CORSRule>
                  <AllowedOrigin>*</AllowedOrigin>
                  <AllowedMethod>GET</AllowedMethod>
                  <MaxAgeSeconds>3000</MaxAgeSeconds>
                  <AllowedHeader>Authorization</AllowedHeader>
                </CORSRule>
               </CORSConfiguration>`
            ]
          }
        ],
        directory: filesRoot
      }),
      createInstance = async.memoize(callback => {
        instance.run((err, host, port) => {
          callback(err, { host, port })
        })
      })

// manage temp files.
mkdirp.sync(filesRoot)
process.on('exit', function() {
  try {
    rm(filesRoot)
  } catch (e) {}
})

module.exports = {

  createLocationConfiguration(name) {

    return {
      name,
      label: 'test',
      active: true,
      managed: false,
      exportTtlDays: 7,
      readUrlExpiry: 900,
      passive: true,
      accessKeyId: 'S3RVER',
      secretAccessKey: 'S3RVER',
      bucket: config('test.s3rver.bucket'),
      prefix: '',
      endpoint: `https://${config('test.s3rver.host')}:${config('test.s3rver.port')}/${config('test.s3rver.bucket')}/`,
      ca: fs.readFileSync(path.join(__dirname, 'location.cert')),
      type: 's3-endpoint'
    }

  },

  fileExistsInBucket(file) {
    return fs.existsSync(path.join(filesRoot, config('test.s3rver.bucket'), `${file}._S3rver_metadata.json`))
  },

  async getServer() {
    return new Promise((resolve, reject) => {
      createInstance((err, object) => {
        err ? reject(err) : resolve(object)
      })
    })
  }

}
