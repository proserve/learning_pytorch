'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('CTXAPI-1811 - WritableOutputCursor should bubble up error.', () => {

  it('transform should throw rather than silently close and complete.', async() => {

    let err
    try {
      await promised(null, sandboxed(function() {
        const { org: { objects: { Account } } } = global,
              cursor = Account.find().grant('read').paths('_id').skipAcl().transform(`
                each(doc, memo, { cursor }) {
                  cursor.push({
                    _id: doc._id
                  })
                  throw Fault.create('cortex.error.foo')       
                }
            `)
        return cursor.toArray()
      }))
    } catch (e) {
      err = e
    }
    should.exist(err)
    err.errCode.should.equal('cortex.error.foo')

  })

})
