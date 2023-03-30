'use strict'

module.exports = function(callback) {

  const modules = require('../../modules'),
        async = require('async'),
        Fault = require('cortex-service/lib/fault')

  modules.db.models.org.loadOrg('otsuka', (err, org) => {

    if (err) {
      return callback(err)
    }

    org.createObject('c_step_response', (err, object) => {

      if (err) {
        return callback(err)
      }

      object = object.getModelForType('c_consent_review')

      let hasMore = true

      async.whilst(

        () => hasMore,

        callback => {

          const match = { reap: false, org: org._id, object: 'c_step_response', type: 'c_consent_review', c_file: { $exists: 1 }, facets: { $size: 0 } }

          modules.db.sequencedFunction(
            function(callback) {
              object.findOne(match).lean().exec((err, doc) => {

                if (err || !doc) {
                  hasMore = false
                  return callback(err)
                }

                const sequence = doc.sequence,
                      fileNode = object.schema.node.findNode('c_file'),
                      facetId = doc.c_file.facets[0],
                      awsId = `${org._id}/${object.objectId}/${doc._id}.c_file/${facetId}.pdf`,
                      pointer = new modules.storage.AwsS3Pointer(null, { meta: [{ name: 'awsId', value: awsId, pub: false }] })

                pointer.info((err, info) => {

                  let ETag = '', size = 0, state = 3
                  if (err) {
                    if (err.code === 'kNotFound') {
                      err = null
                    } else {
                      return callback(err)
                    }
                  } else {
                    ETag = info.ETag.replace(/"/g, '')
                    size = info.size
                    state = 2
                  }

                  const update = {
                    facets: [{
                      filename: 'cst.pdf',
                      ETag: ETag,
                      mime: 'application/pdf',
                      size: size,
                      pid: facetId,
                      location: 4,
                      name: 'content',
                      state: state,
                      private: false,
                      creator: doc.c_file.creator,
                      meta: [
                        {
                          name: 'awsId',
                          value: awsId,
                          pub: false
                        }
                      ],
                      _pi: fileNode._id,
                      _kl: false,
                      _up: facetId.getTimestamp()
                    }]
                  }

                  object.collection.updateOne(
                    Object.assign({}, match, { _id: doc._id, sequence }),
                    {
                      $set: update,
                      $inc: { sequence: 1 }
                    },
                    (err, result) => {
                      if (!err && result['matchedCount'] === 0) {
                        err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error (su)' })
                      }
                      callback(err)
                    }
                  )

                })

              })
            },
            10,
            callback
          )

        },

        callback
      )

    })

  })

}
