'use strict'
const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-967 - Expressions - Plain objects cannot be built using sub-elements on $project operator.', function() {

  it('should support sub-object', async function() {

    let result = await sandboxed(function() {

      return require('expressions').pipeline.run([
        {
          $project: {
            foo: '$foo',
            sub: {
              foo: '$foo',
              bar: {
                $object: {
                  foo: '$foo'
                }
              }
            }
          }
        }
      ], [{
        foo: 'bar'
      }]).toArray()[0]

    })()

    result.foo.should.equal('bar')
    result.sub.foo.should.equal('bar')
    result.sub.bar.foo.should.equal('bar')

  })

})
