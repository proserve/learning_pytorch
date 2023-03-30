const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { cache: { memory } } = require('../../../modules'),
      { driver: { Driver } } = require('../../../modules'),
      { isInt, array: toArray, isPlainObject, roughSizeOfObject, isId, promised } = require('../../../utils'),
      hasher = require('object-hash'),
      MAX_CACHE_SIZE = '1mb',
      MAX_ITEM_SIZE = 8192,
      cache = memory.add('cortex.expressions.operator$dbNext', {
        maxSize: MAX_CACHE_SIZE,
        withEvents: true,
        cycleCache: true,
        cycleStrategy: 'Usage',
        minAge: 0,
        allowNull: true,
        cacheAnyways: true,
        synchronous: true
      })

let Undefined

function replacer(value) {

  if (value && isId(value)) {
    return value.toString()
  }
  return value
}

class Operator$dbNext extends Operator {

  parse(value, expression) {

    // support both a plain object with options or an expression. + ttl (2 elements max
    const [options, ttl] = toArray(value, true).slice()

    super.parse(
      [
        isPlainObject(options) && !ExpressionFactory.get('operator').isA(options)
          ? ExpressionFactory.create('literal', options, { parent: expression })
          : ExpressionFactory.guess(options, { parent: expression }),
        ExpressionFactory.guess(ttl, { parent: expression })
      ],
      expression
    )
  }

  async evaluate(ec) {

    let cacheKey, err, result

    const [options, ttl] = await Promise.all([
            this.value[0].evaluate(ec),
            this.value[1].evaluate(ec)
          ]),
          { ac: { org, req, script, principal } } = ec,
          hash = hasher({ options, principal: principal.toObject() }, { replacer, algorithm: 'sha1', encoding: 'hex' })

    if (isInt(ttl)) {
      cacheKey = `${org.code}.${hash}`
      let cached = cache.get(cacheKey)
      if (cached && (cached.stamp + (ttl * 1000)) >= Date.now()) {
        cached.stamp = Date.now()
        return cached.result
      }
    }

    {
      const object = await org.createObject(options && options.object),
            driver = new Driver(principal, object, { req, script }),
            operation = driver.createOperation('cursor', { parent: req && req.operation }),
            cursor = await operation.execute({ ...options, limit: 1 }, options)

      try {
        if (!(await promised(cursor, 'hasNext'))) {
          result = Undefined
        } else {
          result = await promised(cursor, 'next')
        }
      } catch (e) {
        err = e
      }

      try {
        await promised(cursor, 'close')
      } catch (e) { }

    }

    if (err) {
      throw err
    }

    if (cacheKey) {
      try {
        roughSizeOfObject(result, MAX_ITEM_SIZE)
        cache.set(cacheKey, { result, stamp: Date.now() })
      } catch (e) { }
    }

    return result

  }

}

module.exports = Operator$dbNext
