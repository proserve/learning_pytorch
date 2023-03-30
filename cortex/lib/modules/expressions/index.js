const { ExpressionFactory, TypeFactory, OperatorFactory, ApiFactory } = require('./factory'),
      Fault = require('cortex-service/lib/fault'),
      Expression = require('./expression'),
      Pipeline = require('./pipeline'),
      ExpressionContext = require('./expression-context'),
      { literalObjectOrArrayToExpression } = require('./expression-utils'),
      hasher = require('object-hash'),
      { cache: { memory }, db: { models } } = require('../../modules'),
      cache = memory.add('cortex.expressions.runtime'),
      { isCustomName } = require('../../utils')

function createContext(ac, value, variables = {}) {

  return new ExpressionContext({ expression: parseExpression(value), ac, variables })

}

function createPipeline(ac, value, variables = {}) {

  return new ExpressionContext({ expression: parsePipeline(value), ac, variables })

}

function parseExpression(expression) {

  return expression instanceof Expression ? expression : ExpressionFactory.guess(literalObjectOrArrayToExpression(expression))

}

function parsePipeline(pipeline) {

  return pipeline instanceof Pipeline ? pipeline : new Pipeline().initialize(pipeline)

}

async function getRuntime(org, expression, { runtime = null, type = 'expression' } = {}) {

  const isPipeline = type === 'pipeline'

  if (isCustomName(expression, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)) {

    runtime = runtime || await org.getRuntime()

    const from = runtime[isPipeline ? 'pipelines' : 'expressions'],
          object = from.find(v => v.name === expression)

    if (!object) {

      throw Fault.create('cortex.notFound.unspecified', { reason: `Missing ${type}.`, resource: `expression#${type}.name(${expression})` })

    } else {

      const { type, objectHash, metadata: { runtime, expressionId } } = object

      let { value } = object,
          cacheKey = `runtime.${type}.${objectHash}`,
          compiled = objectHash && cache.get(cacheKey),
          localHash = objectHash

      if (!compiled) {

        if (!runtime) {

          const Model = models.getModelForType('Expression', type)
          let model = await Model.findOne({ _id: expressionId, reap: false, org: org._id, object: 'expression', type }).exec()
          if (objectHash !== model.objectHash) {
            localHash = null
          }
          value = model && model[type]
        }

        if (!localHash) {
          localHash = hasher(value, { algorithm: 'sha256', encoding: 'hex' })
          cacheKey = `${type}.${localHash}`
        }

        compiled = isPipeline ? parsePipeline(value) : parseExpression(value)
        cache.set(cacheKey, compiled)
      }

      return compiled

    }

  } else if (expression instanceof Expression) {

    return expression

  } else {

    const expressionHash = hasher(expression, { algorithm: 'sha256', encoding: 'hex' }),
          cacheKey = `shared.${type}.${expressionHash}`

    let compiled = cache.get(cacheKey)

    if (!compiled) {
      compiled = isPipeline ? parsePipeline(expression) : parseExpression(expression)
      cache.set(cacheKey, compiled)
    }

    return compiled

  }

}

module.exports = {
  createContext,
  createPipeline,
  Expression,
  parseExpression,
  parsePipeline,
  ExpressionFactory,
  OperatorFactory,
  TypeFactory,
  ApiFactory,
  getRuntime
}
