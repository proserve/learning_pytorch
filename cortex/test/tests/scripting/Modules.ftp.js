'use strict'

const wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    const ftp = require('ftp')

    // #1
    ;(function blacklistedHost() {
      try {
        ftp.create({
          host: 'api.medable.com',
          port: 21,
          user: 'user',
          password: 'password',
          secureOptions: {
            rejectUnauthorized: false
          }
        })

      } catch (err) {
        if (err.reason === 'access to host is prohibited (api.medable.com)') {
          return
        }
        throw err
      }
      throw new Error('blacklisted host should cause an error.')
    }())

    // #2
    ;(function blacklistedPort() {

      try {
        ftp.create({
          host: 'some.host',
          port: 22,
          user: 'user',
          password: 'password',
          secureOptions: {
            rejectUnauthorized: false
          }
        })

      } catch (err) {
        if (err.reason === 'access to port is prohibited (22)') {
          return
        }
        throw err
      }
      throw new Error('blacklisted port should cause an error.')
    }())

    return true

  },

  before: function(ac, model, callback) {
    ac.__origSettings = JSON.parse(JSON.stringify(ac.org.configuration.scripting.toObject()))
    ac.org.configuration.scripting.enableFtpModule = true
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
