'use strict'

const path = require('path'),
      saSandboxed = require('../../lib/sandboxed-standalone')

function sandboxed(main, handle) {

  const api = {
          debug: {
            echo: function(val, callback) {
              callback(null, val)
            }
          }
        },
        fn = saSandboxed(
          main,
          {
            jspath: path.resolve(path.join(__dirname, '../../../lib/modules/sandbox/scripts/build/modules')),
            transpile: true,
            enableDebugModule: true,
            api: api
          }
        )
  return callback => {
    fn((err, result) => {
      handle(err, result, (err, result) => {
        if (err) {
          console.log(err)
        }
        callback(err, result)
      })
    })
  }
}

describe('Sandbox', function() {

  describe('Marshalling', function() {

    it('should fail to marshall evil getter calling script api', sandboxed(function() {

      class Evil {

        doEvil() {
          while (1) { ; }
        }
        get foo() {
          return 'bar'
        }

      }
      Object.defineProperty(
        Evil.prototype,
        'foo',
        {
          enumerable: true
        }
      )
      require('debug').echo(new Evil())

    }, function(err, result, callback) {

      const should = require('should')

      should.exist(err)
      err.errCode.should.equal('script.error.marshalling')

      return callback()

    }))

    it('should fail to marshall evil getter post-script', sandboxed(function() {

      class Evil {

        doEvil() {
          while (1) { ; }
        }
        get foo() {
          return 'bar'
        }

      }
      Object.defineProperty(
        Evil.prototype,
        'foo',
        {
          enumerable: true
        }
      )
      return new Evil()

    }, function(err, result, callback) {

      const should = require('should')

      should.exist(err)
      err.errCode.should.equal('script.error.marshalling')

      return callback()

    }))

  })

})
