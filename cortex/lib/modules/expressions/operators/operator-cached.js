const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      ExpressionRules = require('../expression-rules'),
      config = require('cortex-service/lib/config'),
      { cache: cacheModule } = require('../../../modules'),
      { memory } = cacheModule,
      { isString, isBoolean } = require('underscore'),
      { isInt, roughSizeOfObject, promised, isSet, rInt } = require('../../../utils'),
      cacheModuleKeyPrefix = 'operator$cached:',
      MAX_ITEM_SIZE = config('caches.cortex.expressions.operator$cached'),
      localCache = memory.add('cortex.expressions.operator$cached')

let Undefined

/**
 * {
 *   key: <expr> cacheKeyPrefix + cache key when not local.
 *   in: <expr> expression value to be cached
 *   ttl: <expr> time to live in seconds, default 60 seconds.
 *   local: true/false if true, stores the value. default true.
 *   bump: true/false if true, bumps the ttl value whenever it's retrieved. default false
 * }
 */
class Operator$cached extends Operator {

  parse(value, expression) {

    ExpressionRules.valueMustBeObject(expression, this, value)

    super.parse(
      {
        key: isString(value.key) ? value.key : ExpressionFactory.guess(value.key, { parent: expression }),
        in: ExpressionFactory.guess(value.in, { parent: expression }),
        ttl: isInt(value.ttl) ? value.ttl : ExpressionFactory.guess(value.ttl, { parent: expression }),
        local: (v => {
          if (!isSet(v)) {
            return true
          } else if (isBoolean(v)) {
            return v
          }
          return ExpressionFactory.guess(v, { parent: expression })
        })(value.local),
        bump: (v => {
          if (!isSet(v)) {
            return false
          } else if (isBoolean(v)) {
            return v
          }
          return ExpressionFactory.guess(v, { parent: expression })
        })(value.bump)
      },
      expression
    )
  }

  async evaluate(ec) {

    const { value } = this,
          { ac: { org } } = ec,
          [ key, ttl, local, bump ] = await Promise.all([
            isString(value.key) ? value.key : value.key.evaluate(ec),
            isInt(value.ttl) ? value.ttl : value.ttl.evaluate(ec),
            isBoolean(value.local) ? value.local : value.local.evaluate(ec),
            isBoolean(value.bump) ? value.bump : value.bump.evaluate(ec)
          ])

    let cacheKey, result

    if (local) {

      cacheKey = `${org.code}.${key}`
      let cached = localCache.get(cacheKey)

      if (cached) {
        if (!isInt(ttl)) {
          return cached.result
        }
        if ((cached.stamp + (ttl * 1000)) >= Date.now()) {
          if (bump) {
            cached.stamp = Date.now()
          }
          return cached.result
        }
      }

      result = await value.in.evaluate(ec)

      if (cacheKey) {
        try {
          roughSizeOfObject(result, MAX_ITEM_SIZE)
          localCache.set(cacheKey, { result, stamp: Date.now() })
        } catch (e) { }
      }

    } else {

      const cacheTtl = rInt(ttl)

      let cacheSet = bump && isInt(ttl)

      cacheKey = `${cacheModuleKeyPrefix}${key}`

      result = await promised(cacheModule, 'get', org, cacheKey)

      if (result === Undefined) {
        result = await value.in.evaluate(ec)
        cacheSet = true
      }

      if (cacheSet) {
        try {
          roughSizeOfObject(result, MAX_ITEM_SIZE)
          await promised(cacheModule, 'set', org, cacheKey, result, cacheTtl)
        } catch (e) {
        }
      }
    }

    return result

  }

}

module.exports = Operator$cached
