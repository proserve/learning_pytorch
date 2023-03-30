'use strict'

require('should')

const server = require('../../lib/server'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  skip: true,

  main: function() {

    /* global script */

    require('should')

    // some response coverage (call as non-route)
    // noinspection NpmUsedModulesInstalled
    const res = require('response')

    let a,
        b,
        used,
        free,
        useSome, // eslint-disable-line no-unused-vars
        aa,
        bb

    res.setHeader('a', 'b')
    res.setCookie('a', 'b')
    res.setStatusCode(200)
    res.write('a');

    // http as inline trigger coverage.
    (function() {
      try {
        var http = require('http')
        http.get('https://www.google.ca')
      } catch (err) {
        if (err.code === 'kAccessDenied') {
          return
        }
        throw err
      }
      throw new Error('script.arguments.new with blank path should cause an error.')
    }())

    a = script.getOpsRemaining()
    b = script.getOpsRemaining()

    if (b >= a || b <= 0) {
      throw Error('Ops should be used but have some remaining')
    }

    if (script.getOpsUsed() === 0) {
      throw Error('getOpsUsed should show some usage.')
    }

    if (script.getTimeLeft() === 0) {
      throw Error('getTimeLeft should show some time left.')
    }

    if (script.getElapsedTime() === 0) {
      throw Error('getElapsedTime should show some time used.')
    }

    if (parseInt(script.getCalloutsRemaining()) !== script.getCalloutsRemaining()) {
      throw Error('getCalloutsRemaining should be a number.')
    }

    if (script.getNotificationsRemaining() === 0) {
      throw Error('getNotificationsRemaining should be greater than 0.')
    }

    // noinspection JSAnnotator
    script.arguments.new.update('c_a', ['foo'])
    // noinspection JSAnnotator
    script.arguments.new.update('c_a') // empty payload
    // noinspection JSAnnotator
    script.arguments.new.update() // empty payload
    // noinspection JSAnnotator
    script.arguments.new.update({ c_a: ['foo'] })
    // noinspection JSAnnotator
    script.arguments.new.push('c_a', 'bar')
    // noinspection JSAnnotator
    script.arguments.new.push({ c_a: 'bar' })
    // noinspection JSAnnotator
    script.arguments.new.push('c_a') // empty payload
    // noinspection JSAnnotator
    script.arguments.new.push() // empty payload
    // noinspection JSAnnotator
    script.arguments.new.delete('c_a.bar');

    (function() {
      try {
        // noinspection JSAnnotator
        script.arguments.new.delete()
      } catch (err) {
        if (err.reason === 'A string property path is required.') {
          return
        }
        throw err
      }
      throw new Error('script.arguments.new with blank path should cause an error.')
    }())

    // test memory usage

    used = script.getMemoryUsed()
    free = script.getMemoryFree()

    useSome = 'string'.repeat(1000) // eslint-disable-line no-unused-vars
    script.getMemoryUsed().should.be.greaterThan(used)
    script.getMemoryFree().should.be.lessThan(free)
    useSome = null

    // test gc

    script.gc()

    aa = {
      s: '1'.repeat(500)
    }
    bb = {
      s: '2'.repeat(500)
    }
    aa.bb = bb; bb.aa = aa

    script.gc().should.equal(96)
    script.gc() // now free what "should.equal(0)" used.

    aa = null
    bb = null

    // gc aa and bb. should have the released object strings plus a little overhead.
    script.gc().should.be.greaterThan(1000).and.lessThan(1500)

    return true

  },

  before: function(ac, model, callback) {

    // install a trigger and a custom object to test subject updates.
    async.series([

      // create a custom object to receiver the trigger
      callback => {

        modules.db.models.object.aclCreate(
          server.principals.admin,
          {
            label: 'ScriptTrigger',
            name: 'c_script_trigger',
            createAcl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole }],
            defaultAcl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }],
            properties: [{
              label: 'c_a',
              name: 'c_a',
              type: 'String',
              array: true,
              writable: true,
              canPush: true,
              canPull: true
            }]
          },
          err => {
            callback(err)
          }
        )
      },

      // install a before create trigger
      callback => {

        const Script = modules.db.models.getModelForType('script', 'trigger'),
              script = new Script(model.toObject())

        script.type = 'trigger'

        let modelAc

        modelAc = new acl.AccessContext(ac.principal, script, { method: 'put' })
        script.aclWrite(modelAc, { configuration: {
          inline: true,
          object: 'c_script_trigger',
          event: 'create.before',
          rootDocument: 'document'
        } }, err => {
          if (err) {
            callback(err)
          } else {
            modelAc.save(err => {
              callback(err)
            })
          }
        })
      },

      // fire the trigger.
      callback => {

        ac.org.createObject('c_script_trigger', (err, model) => {

          if (err) {
            return callback(err)
          }

          model.aclCreate(ac.principal, {}, err => {
            callback(err)
          })

        })

      }

    ], callback)

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
