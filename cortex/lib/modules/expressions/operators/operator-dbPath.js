const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { once } = require('underscore'),
      { cache: { memory } } = require('../../../modules'),
      { isInt, array: toArray, pathParts, promised, isUuidString, OutputCursor, digIntoResolved, roughSizeOfObject, couldBeId } = require('../../../utils'),
      MAX_CACHE_SIZE = '1mb',
      MAX_ITEM_SIZE = 8192,
      cache = memory.add('cortex.expressions.operator$dbPath', {
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

class Operator$dbPath extends Operator {

  parse(value, expression) {

    super.parse(
      toArray(value, true).map((entry, index) =>
        ExpressionFactory.guess(entry, { parent: expression, path: index })
      ),
      expression
    )
  }

  async evaluate(ec) {

    let Model, cacheKey, result

    const [path, ttl] = await Promise.all(
            this.value.map(expression => expression.evaluate(ec))
          ),
          { ac } = ec,
          principal = ac.principal.clone().merge(ac, { skipAcl: true, grant: 'script' }),
          [object, fullPath] = pathParts(path)

    if (isInt(ttl)) {
      cacheKey = `${ac.org.code}.${path}`
      let cached = cache.get(cacheKey)
      if (cached && (cached.stamp + (ttl * 1000)) >= Date.now()) {
        cached.stamp = Date.now()
        return cached.result
      }
    }

    Model = await ac.org.createObject(object, { throw: false })

    if (!Model) {
      return Undefined
    }

    result = await new Promise((resolve) => {

      const [_id, propertyPath] = pathParts(fullPath),
            isCustom = Model.uniqueKey && (!couldBeId(_id) || isUuidString(_id)),
            cursorOptions = {
              limit: 1
            },
            through = once(async(err, result) => {
              if (!err) {
                if (result instanceof OutputCursor) {
                  const cursor = result
                  result = await promised(cursor, 'next')
                  try {
                    await promised(cursor, 'close')
                  } catch (e) {}
                }
              }

              if (err) {
                resolve(Undefined)
              } else {
                resolve(await ec.readObject(result, Undefined))
              }

            }),
            readOptions = {
              allowNullSubject: true,
              paths: [propertyPath],
              singlePath: propertyPath,
              singleCursor: true,
              singleOptions: cursorOptions,
              singleCallback: through,
              passive: true,
              where: { [isCustom ? Model.uniqueKey : '_id']: _id },
              ...cursorOptions
            }

      if (!fullPath) {
        Model.aclCursor(principal, cursorOptions, through)
      } else {
        Model.aclReadOne(principal, null, readOptions, function(err, result) {
          through(err, digIntoResolved(result, propertyPath, false, false, true))
        })
      }

    })

    if (cacheKey) {
      try {
        roughSizeOfObject(result, MAX_ITEM_SIZE)
        cache.set(cacheKey, { result, stamp: Date.now() })
      } catch (e) { }

    }

    return result

  }

}

module.exports = Operator$dbPath
