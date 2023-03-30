const Stage = require('../stage'),
      { Empty } = require('../expression-utils'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      { isSet, promised } = require('../../../utils')

let Undefined

/**
 * {
 *   set: { vars }
 *   in: <expr>
 * }
 */
class Phase {

  static parse(expression, value, path) {

    const phase = {
      set: {},
      in: Undefined
    }

    ExpressionRules.valueMustBeObject(expression, expression, value, `${expression.fullPath}.${path}`)

    if (isSet(value.set)) {
      phase.set = ExpressionRules.parseUserVariables(expression, value.set, `${path}.set`, { register: false })
      for (const name of Object.keys(phase.set)) {
        if (!expression.isVariableRegistered(name, true)) {
          throw Fault.create('cortex.invalidArgument.query', { reason: `User variable ${name} not found in $transform.`, path: `${expression.fullPath}.${path}.set` })
        }
      }
    }

    if (isSet(value.in)) {
      phase.in = ExpressionFactory.guess(value.in, { parent: expression, path: `${path}.in` })
    }

    ExpressionRules.valueMustBeObjectWithSubstance(expression, this, phase, `${expression.fullPath}.${path}`)

    return phase
  }

  static async evaluate(ec, phase, { force = false, result = Empty } = {}) {

    // resolve sequentially for use of previous value in the next variable.
    if (isSet(phase.set)) {
      for (const name of Object.keys(phase.set)) {
        ec.setVariable(name, await phase.set[name].evaluate(ec))
      }
    }

    if (isSet(phase.in)) {
      result = await phase.in.evaluate(ec)
    }
    if (result === Undefined) {
      result = Empty
    }

    return result

  }

}

/**
 * {
 *   vars: { vars }
 *   before: { set, in }
 *   each: { set, in }
 *   after: { set, in }
 * }
 */
class Stage$transform extends Stage {

  _parseStage(value) {

    ExpressionRules.valueMustBeObject(this, this, value, '', 'Stage')

    const def = { phases: {} },
          stageNames = ['before', 'each', 'after']

    def.vars = isSet(value.vars)
      ? ExpressionRules.parseUserVariables(this, value.vars, 'vars', { register: true })
      : {}

    for (const stageName of stageNames) {
      if (isSet(value[stageName])) {
        def.phases[stageName] = Phase.parse(
          this,
          value[stageName],
          stageName
        )
      }
    }

    ExpressionRules.valueMustBeObjectWithSubstance(this, this, def.phases, `${this.fullPath}.phases`, 'Stage')

    return def

  }

  async _next(ec, next) {
    return next
  }

  async _createInputCursor(ec, { input }) {

    const cursor = TypeFactory.create('Cursor').cast(input),
          inputCursor = await super._createOutputCursor(ec, { input: cursor }),
          _next = inputCursor._next,
          { value: { vars, phases } } = this

    let phase = 'before'

    inputCursor._next = callback => {

      return Promise.resolve(null)
        .then(async() => {

          let result = Empty

          if (phase === 'before') {

            ec.setVariable('$$ROOT', Undefined)

            const variableNames = Object.keys(vars)
            for (const variableName of variableNames) {
              ec.setVariable(
                variableName,
                await vars[variableName].evaluate(ec)
              )
            }
            if (phases.before) {
              result = await Phase.evaluate(ec, phases.before)
            }

            phase = inputCursor.isClosed() ? 'after' : 'each'

          } else if (phase === 'each') {

            result = await promised(inputCursor, _next)
            if (result === Undefined) {
              phase = 'after'
              result = Empty
            } else if (phases.each) {
              ec.setVariable('$$ROOT', result)
              result = await Phase.evaluate(ec, phases.each, { force: true, result })
              if (inputCursor.isClosed()) {
                phase = 'after'
              }
            }

          } else if (phase === 'after') {

            ec.setVariable('$$ROOT', Undefined)
            phase = null
            if (phases.after) {
              result = await Phase.evaluate(ec, phases.after)
            }

          } else {
            result = Undefined
          }

          return result

        })
        .then(result => callback(null, result))
        .catch(callback)

    }

    return inputCursor

  }

}

module.exports = Stage$transform
