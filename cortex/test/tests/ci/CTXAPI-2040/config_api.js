'use strict'

const sandboxed = require('../../../lib/sandboxed')

describe('CTXAPI-2040 - config.keys() publicOnly', function() {

  // create public and private config keys
  before(sandboxed(function() {

    const { set } = require('config')

    set('ctxapi2040-public', 'public', { isPublic: true })
    set('ctxapi2040-private', 'private')

  }))

  // remove keys
  after(sandboxed(function() {

    const { set } = require('config')

    set('ctxapi2040-public', 'public', null)
    set('ctxapi2040-private', 'private', null)

  }))

  it('should only get public keys only', sandboxed(function() {

    const should = require('should'),
          { keys } = require('config'),
          result = keys({ publicOnly: true })

    should.equal(result.includes('ctxapi2040-public'), true)
    should.equal(result.includes('ctxapi2040-private'), false)

  }))

  it('should get all keys', sandboxed(function() {

    const should = require('should'),
          { keys } = require('config'),
          result = keys()

    should.equal(result.includes('ctxapi2040-public'), true)
    should.equal(result.includes('ctxapi2040-private'), true)

  }))

  it('should get values', sandboxed(function() {

    const should = require('should'),
          { keys } = require('config'),
          publicResult = keys({ values: true }).find(({ key }) => key === 'ctxapi2040-public'),
          privateResult = keys({ values: true }).find(({ key }) => key === 'ctxapi2040-private')

    should.equal(publicResult.value, 'public')
    should.equal(publicResult.isPublic, true)
    should.equal(privateResult.value, 'private')
    should.equal(privateResult.isPublic, false)

  }))

  it('regression - should get extended information', sandboxed(function() {

    const should = require('should'),
          { keys } = require('config'),
          defaultResult = keys({ extended: false }),
          extendedResult = keys({ extended: true }),
          publicExtendedResult = keys({ extended: true, publicOnly: true })

    should.equal(defaultResult.includes('ctxapi2040-public'), true)
    should.equal(defaultResult.includes('ctxapi2040-private'), true)

    should.exist(extendedResult.find(({ key }) => key === 'ctxapi2040-public'))
    should.exist(extendedResult.find(({ key }) => key === 'ctxapi2040-private'))

    should.exist(publicExtendedResult.find(({ key }) => key === 'ctxapi2040-public'))
    should.not.exist(publicExtendedResult.find(({ key }) => key === 'ctxapi2040-private'))

  }))

})
