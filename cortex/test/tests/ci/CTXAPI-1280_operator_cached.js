const server = require('../../lib/server'),
      { expressions, cache } = require('../../../lib/modules'),
      { memory } = cache,
      cacheModuleKeyPrefix = 'operator$cached:',
      { promised } = require('../../../lib/utils'),
      { AccessContext } = require('../../../lib/acl'),
      should = require('should')

describe('Issues - CTXAPI-1280 - Operator$cached', function() {

  it('Operator$cached - local set to false', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          remoteCacheKey = 'test_remote_cache_key',
          remoteCacheVal = 'test_remote_cache_val',
          result = await (expressions.createContext(
            ac,
            {
              $cached: {
                key: remoteCacheKey,
                in: { $toString: remoteCacheVal },
                ttl: 1200,
                bump: true,
                local: false
              }
            }
          ).evaluate())

    should.equal(result, await promised(cache, 'get', server.org, `${cacheModuleKeyPrefix}${remoteCacheKey}`))
  })

  it('Operator$cached - local set to true', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          localCache = memory.get('cortex.expressions.operator$cached'),
          localCacheKey = 'test_local_cache_key',
          localCacheVal = 'test_local_cache_val',
          result = await (expressions.createContext(
            ac,
            {
              $cached: {
                key: localCacheKey,
                in: { $toString: localCacheVal },
                ttl: 1200,
                bump: true,
                local: true
              }
            }
          ).evaluate())

    should.equal(result, localCache.get(`${server.org.code}.${localCacheKey}`)?.result)
  })

  it('Operator$cached - referencing a parent in nested operators', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          result = await (expressions.createContext(
            ac,
            {
              $let: {
                vars: {
                    x: 2
                },
                in: {
                    $add: [
                        '$$x',
                        {
                            $cached: {
                                key: 'ctxapi-1280',
                                local: false,
                                bump: false,
                                ttl: 5,
                                in: '$$x'
                            }
                        }
                    ]
                }
              }
            }
          ).evaluate())
    
    should.equal(result, 4)
  })

})
