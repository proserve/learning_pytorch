'use strict'

const modules = require('../../../../modules'),
      { expressions: { getRuntime, parseExpression, parsePipeline, createContext, createPipeline } } = modules

function find(script, type, name) {

  const { ac: { org } } = script

  return getRuntime(org, name, { type })

}

module.exports = {

  version: '1.0.0',

  async parse(script, message, expression) {

    return parseExpression(expression).toJSON()

  },

  async evaluate(script, message, expression, context) {

    const ec = createContext(
      script.ac,
      expression,
      {
        $$ROOT: context
      }
    )

    let err, result

    try {
      result = await ec.evaluate()
    } catch (e) {
      err = e
    }

    return {
      err,
      result,
      ...ec.toJSON()
    }

  },

  async run(script, message, expression, context) {

    const ec = createContext(
      script.ac,
      expression,
      {
        $$ROOT: context
      }
    )

    return ec.evaluate()

  },

  pipeline: {

    async parse(script, message, expression) {

      return parsePipeline(expression)

    },

    async evaluate(script, message, expression, input) {

      const cursor = script.getCursor(input && input.object === 'cursor' && input._id),
            ec = createPipeline(
              script.ac,
              expression
            )

      if (cursor) {
        input = cursor // don't detach here because we will consume on the way out.
      }

      let err, result

      try {
        const cursor = await ec.evaluate({ input })
        for await (const next of cursor) {
          result = next
        }
      } catch (e) {
        err = e
      }

      return {
        err,
        result,
        ...ec.toJSON()
      }

    },

    async run(script, message, expression, input) {

      const cursor = script.getCursor(input && input.object === 'cursor' && input._id),
            ec = createPipeline(
              script.ac,
              expression
            )

      if (cursor) {
        input = cursor.detach()
      }

      let err, result

      try {
        result = await ec.evaluate({ input })
      } catch (e) {
        err = e
      }

      if (err) {
        if (cursor) {
          script.registerCursor(cursor)
        }
        throw err
      }

      return result

    }

  },

  runtime: {

    async evaluate(script, message, name, context) {
      return module.exports.evaluate(script, message, await find(script, 'expression', name), context)
    },

    async run(script, message, name, context) {
      return module.exports.run(script, message, await find(script, 'expression', name), context)
    },

    pipeline: {

      async evaluate(script, message, name, input) {
        return module.exports.pipeline.evaluate(script, message, await find(script, 'pipeline', name), input)
      },

      async run(script, message, name, input) {
        return module.exports.pipeline.run(script, message, await find(script, 'pipeline', name), input)
      }

    }

  }

}
