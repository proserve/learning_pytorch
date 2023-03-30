'use strict'

const server = require('../../lib/server'),
      wrapper = require('../../lib/wrapped_sandbox')

server.usingMedia = true

module.exports = {

  main: function() {

    /* global script, ObjectID, consts */

    const objects = require('objects'),
          connections = require('connections'),
          should = require('should'),
          // create
          instance = objects.create('c_postables')

    // force create connection to another account.
    let list, link, email

    list = connections.create('c_postables', instance._id, { object: 'account', auto: true, _id: script.__mocha_principals__.patient._id }, { connectionAppKey: script.__mocha_app_key__, forceAuto: true, skipAcl: true });

    // auto connect with requireAccept: true and no forceAuto
    (function() {
      try {
        connections.create('c_postables', instance._id, { object: 'account', auto: true, _id: script.__mocha_principals__.unverified._id })
      } catch (err) {
        if (err.errCode === 'cortex.invalidArgument.requireConnectionAccept') {
          return
        }
        throw err
      }
      throw new Error('force connect to unverified should cause an error.')
    }());

    // auto connect to email.
    (function() {
      try {
        connections.create('c_postables', instance._id, { object: 'account', auto: true, _id: script.__mocha_principals__.unverified.email })
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('auto connect to email should cause an error.')
    }());

    // force connect to unverified.
    (function() {
      try {
        connections.create('c_postables', instance._id, { object: 'account', auto: true, _id: script.__mocha_principals__.unverified._id }, { connectionAppKey: script.__mocha_app_key__, forceAuto: true, skipAcl: true })
      } catch (err) {
        if (err.errCode === 'cortex.accessDenied.connectionRequiresVerification') {
          return
        }
        throw err
      }
      throw new Error('force connect to unverified should cause an error.')
    }());

    // force connect to missing account.
    (function() {
      try {
        connections.create('c_postables', instance._id, { object: 'account', auto: true, _id: new ObjectID() }, { connectionAppKey: script.__mocha_app_key__, forceAuto: true, skipAcl: true })
      } catch (err) {
        if (err.errCode === 'cortex.notFound.instance') {
          return
        }
        throw err
      }
      throw new Error('force connect to unverified should cause an error.')
    }());

    // force connect without access to the account being connected.
    (function() {
      try {
        connections.create('c_postables', instance._id, { object: 'account', auto: true, _id: script.__mocha_principals__.unverified._id }, { connectionAppKey: script.__mocha_app_key__, forceAuto: true })
      } catch (err) {
        if (err.errCode === 'cortex.accessDenied.autoConnectionRequiresAccess') {
          return
        }
        throw err
      }
      throw new Error('force connect without access to the account being connected should cause an error.')
    }())

    connections.read(list[0]._id)
    connections.delete(list[0]._id)

    list = connections.list()

    // create a link to another account, read the private email and then destruct.
    link = connections.linkTo('accounts', script.__mocha_principals__.patient._id, consts.accessLevels.read, { skipAcl: true, connectionAppKey: script.__mocha_app_key__, usesRemaining: 1 })
    email = connections.read(link.token + '/context/name/first')
    should.equal(email, script.__mocha_principals__.patient.name.first);

    (function() {
      try {
        connections.read(link.token + '/context/name/first')
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('loading expired connection link should cause an error.')

    }())

    return true
  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
