'use strict'

const wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    const http = require('http')

    // #1
    ;(function invalidHost() {
      try {
        http.get('https://')
      } catch (err) {
        if (err.reason === 'Invalid url format.') {
          return
        }
        throw err
      }
      throw new Error('invalidHost should cause an error.')
    }())

    // #2
    ;(function blacklistedHost() {
      try {
        http.get('https://api.medable.com')
      } catch (err) {
        if (err.reason.match(/^access to host is prohibited/)) {
          return
        }
        throw err
      }
      throw new Error('blacklistedHost should cause an error.')
    }())

    // #3
    ;(function blacklistedPort() {
      try {
        http.get('https://www.google.com:21')
      } catch (err) {
        if (err.reason.match(/^access to port is prohibited/)) {
          return
        }
        throw err
      }
      throw new Error('blacklistedPort should cause an error.')
    }())

    // #4
    ;(function blacklistedIpV4Address() {
      try {
        http.get('https://192.168.3.6')
      } catch (err) {
        if (err.reason.match(/^invalid or prohibited host ip address/)) {
          return
        }
        throw err
      }
      throw new Error('blacklistedIpV4Address should cause an error.')
    }())

    // #5
    ;(function blowMaxResponseSize() {
      try {
        http.get('https://www.google.com')
      } catch (err) {
        if (err.reason === 'Maximum callout response size exceeded.') {
          return
        }
        throw err
      }
      throw new Error('blowMaxResponseSize should cause an error.')
    }())

    // #6
    ;(function blowMaxRequestSize() {
      try {
        var string = ''
        while (string.length <= 1000) {
          string += 'hold me thrill me repeat me'
        }
        http.post('https://www.example.org', { body: string })
      } catch (err) {
        if (err.reason === 'maxCalloutRequestSize exceeded.') {
          return
        }
        throw err
      }
      throw new Error('blowMaxRequestSize should cause an error.')
    }())

    // #7
    ;(function blowMaxRequestSize() {
      try {
        var string = ''
        while (string.length <= 1000) {
          string += 'hold me thrill me repeat me'
        }
        http.post('http://www.example.org', { body: string })
      } catch (err) {
        if (err.reason === 'maxCalloutRequestSize exceeded.') {
          return
        }
        throw err
      }
      throw new Error('blowMaxRequestSize should cause an error.')
    }())

    // #8 -- should succeed
    http.get('https://example.org')

    // #9
    ;(function invalidProtocol() {
      try {
        http.get('ftp://not.allowed.com')
      } catch (err) {
        if (err.reason === 'unsupported protocol') {
          return
        }
        throw err
      }
      throw new Error('invalidProtocol should cause an error.')
    }())

    // #10
    ;(function blowMaxCallouts() {
      try {
        http.get('https://example.org')
      } catch (err) {
        if (err.reason === 'Callout limit exceeded.') {
          return
        }
        throw err
      }
      throw new Error('blowMaxCallouts should cause an error.')
    }())

    return true

  },

  before: function(ac, model, callback) {

    ac.__origSettings = JSON.parse(JSON.stringify(ac.org.configuration.scripting.toObject()))
    const scripting = ac.org.configuration.scripting
    scripting.maxCalloutResponseSize = 4000 // so we blow up on #5
    scripting.maxCalloutRequestSize = 1000 // so we blow up on #6
    scripting.maxCallouts = 9 // so we blow up on #8
    scripting.maxCalloutRequestTimeout = 2000
    scripting.types.route.timeoutMs = 20000 // this test might take a while.
    callback()

  },

  after: function(err, result, ac, model, callback) {
    ac.org.configuration.scripting = ac.__origSettings
    callback(err, result)

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
