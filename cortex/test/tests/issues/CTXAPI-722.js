'use strict'

const should = require('should'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed'),
      { v4 } = require('uuid'),
      { sleep, promised, isSet, equalIds } = require('../../../lib/utils')

describe('Issues - CTXAPI-722 getting memo undefined in onComplete method', function() {
  it('simple headless aggregation', async function() {

    let op
    const cacheKey = `ctxapi-722-${v4()}`

    op = await promised(null, sandboxed(function() {
      /* global script, org */
      const { cacheKey } = script.arguments

      return org.objects.bulk()
        .add(
          org.objects.Account
            .aggregate()
            .transform({
              autoPrefix: true,
              script: `
                  beforeAll(memo) {
                    memo.opsExecuted.push('account')
                  }
                `
            }), { wrap: false }
        ).add(
          org.objects.Org
            .aggregate()
            .transform({
              autoPrefix: true,
              script: `
                  beforeAll(memo) {
                    memo.opsExecuted.push('org')
                  }
                `
            }), { wrap: false }
        )
        .transform({
          autoPrefix: true,
          script: `
                  beforeAll(memo) {
                    memo.started = true
                  }
                `,
          memo: {
            flag: true,
            opsExecuted: [],
            cacheKey
          }
        })
        .async({
          onComplete: `
             const { memo } = script.arguments,
                    cache = require('cache')
             cache.set('${cacheKey}', memo) 
          `
        })
        .next()

    }, {
      runtimeArguments: {
        cacheKey
      }
    }))

    op = modules.runtime.db.findOne({ uuid: op.uuid }).export()
    op.type.should.equal('db.bulk')

    while (1) {
      const cached = await promised(modules.cache, 'get', server.org, cacheKey)
      if (isSet(cached)) {
        cached.should.deepEqual({
          started: true,
          flag: true,
          opsExecuted: [ 'account', 'org' ],
          cacheKey
        })
        break
      }
      await sleep(10)
    }
    return true

  })

})
