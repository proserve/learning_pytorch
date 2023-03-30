'use strict'

require('should')

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-350 - Script transforms are not cancelled if the output cursor is closed', function() {

  it('should cancel the transform after closing the output cursor', sandboxed(function() {
    /* global org */

    // 1. run bulk transform.
    const { Accounts, bulk } = org.objects,
          { sleep } = require('debug'),
          { operations: { cancel, find } } = require('runtime'),
          cache = require('cache'),
          should = require('should'),
          memo = {
            index: 0,
            total: 100
          }

    cache.set('c_ctxapi_350', false)

    let op

    op = bulk()

      .add(

        Accounts.aggregate()
          .limit(1)
          .project({
            num: new Array(memo.total).fill({ $number: 1 })
          })
          .unwind('num')
          .transform(
            {
              memo,
              autoPrefix: true,
              script: `                                             
              each(object, memo) {
                require('debug').sleep(100)
                require('debug').log('inserted ' + memo.index)
                memo.index++
              }    
          `
            })
      )
      .async({
        lock: {
          name: 'c_ctxapi_350',
          restart: false
        },
        onComplete: `
      require('debug').log(script.arguments)
      require('cache').set('c_ctxapi_350', true)
    `
      })
      .next()

    // soon after, cancel the operation.
    sleep(250)
    cancel({ uuid: op.uuid })

    // observe the operation run its onComplete handler
    while (!cache.get('c_ctxapi_350')) {
      let operation = find({ uuid: op.uuid })[0]
      should.exist(operation)
      should.equal(operation.cancelled, true)
      sleep(250)
    }
  }))
})
