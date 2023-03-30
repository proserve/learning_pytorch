'use strict'

const async = require('async'),
      _ = require('underscore'),
      server = require('./server')

let called = false, ready = false, instanceErr, instanceAc, objectAc

module.exports = function(ac, callback) {

  const acl = require('../../lib/acl'),
        consts = require('../../lib/consts'),
        modules = require('../../lib/modules/index')

  if (called) {

    if (ready || instanceErr) {
      return callback(instanceErr, instanceAc, objectAc)
    }

    // poll for ready media state. doind this here let's the tests get underway while we process media async.
    let err, timeoutId = null, done = false

    const doneStage = e => {

      ready = done
      if (e) {
        err = e
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (callback) {
        callback(err, instanceAc, objectAc)
        callback = null
      }
    }

    timeoutId = setTimeout(() => {
      doneStage(err = new Error('timed out waiting for streamable media to process'))
    }, 10000)

    async.whilst(

      () => !done && !err,

      callback => {

        instanceAc.object.findOne({ _id: instanceAc.subjectId }).select('facets.state').lean().exec((err, doc) => {

          if (!err) {
            done = _.all(doc.facets, facet => facet.state === consts.media.states.ready)
            if (_.some(doc.facets, facet => facet.state === consts.media.states.error)) {
              err = new Error('Some facets had processing errors')
            }
          }
          setTimeout(() => callback(err), 10)

        })
      },

      e => doneStage(err || e)

    )

    return

  }

  called = true

  async.waterfall([

    // create a custom object to test streaming.
    callback => {
      modules.db.models.Object.aclCreate(server.principals.admin, {
        name: 'c_script_mod_obj_stream_test',
        label: 'Test',
        defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
        createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
        shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
        properties: [{
          label: 'Label',
          name: 'c_label',
          type: 'String',
          writable: true
        }, {
          label: 'Removable',
          name: 'c_removable',
          type: 'String',
          writable: true,
          removable: true
        }, {
          label: 'Numbers',
          name: 'c_numbers',
          type: 'Number',
          writable: true,
          array: true,
          canPush: true,
          canPull: true
        }, {
          label: 'File',
          name: 'c_file',
          type: 'File',
          writable: true,
          processors: [{
            label: 'Content',
            type: 'passthru',
            name: 'content',
            source: 'content',
            mimes: 'text/plain',
            required: true,
            passMimes: false,
            private: false,
            allowUpload: true
          }, {
            label: 'Image',
            type: 'image',
            name: 'c_image',
            source: 'c_image',
            mimes: 'image/png',
            required: false,
            passMimes: false,
            private: false,
            allowUpload: true
          }, {
            label: 'Gray Scale - Resized',
            type: 'image',
            name: 'c_gray',
            source: 'c_image',
            mimes: 'image/png',
            required: false,
            passMimes: false,
            private: false,
            allowUpload: false,
            grayscale: true,
            imageWidth: 100
          }]
        }]
      }, (err, { ac }) => callback(err, ac))
    },

    // store an instance
    (objectAc, callback) => {

      const pointer = new modules.storage.FilePointer(null, { path: `${__dirname}/../files/plain.txt`, mime: 'text/plain' }, objectAc)

      ac.org.createObject('c_script_mod_obj_stream_test', function(err, object) {

        if (err) return callback(err)

        object.aclCreate(ac.principal, { c_label: '', c_file: { content: pointer } }, (err, { ac }) => {
          callback(err, ac, objectAc)
        })
      })
    },

    (_ac, objectAc, callback) => {
      server.updateOrg(err => callback(err, _ac, objectAc))
    }

  ], (err, _ac, _oac) => {
    instanceErr = err
    instanceAc = _ac
    objectAc = _oac
    callback(err, instanceAc, objectAc)
  })

}
