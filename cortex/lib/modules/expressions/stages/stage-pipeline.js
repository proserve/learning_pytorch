const Stage = require('../stage'),
      Pipeline = require('../pipeline'),
      ExpressionContext = require('../expression-context'),
      ExpressionRules = require('../expression-rules'),
      { getRuntime } = require('../../expressions'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      { isCustomName, isSet, isPlainObject } = require('../../../utils'),
      { VariableScope, AccessScope } = require('../scope')

let Undefined

class Stage$pipeline extends Stage {

  static isA(value) {

    if (super.isA(value)) {
      return true
    }

    const keys = isSet(value) && Object.keys(value),
          key = keys && keys[0],
          name = key?.split('$')[1]

    return isPlainObject(value) && keys.length === 1 && isCustomName(name, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)

  }

  parse(value) {

    const keys = isSet(value) && Object.keys(value),
          key = keys && keys[0],
          name = key.split('$')[1],
          user = isCustomName(name, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)

    if (user) {
      value = {
        $pipeline: {
          as: value[key],
          in: name
        }
      }

    }

    super.parse(value)

  }

  _parseStage(value) {

    if (isCustomName(value, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)) {
      value = {
        in: value
      }
    } else if (Array.isArray(value)) {
      value = {
        in: value
      }
    }

    ExpressionRules.valueMustBeObject(this, this, value)

    if (isPlainObject(value.as) && !ExpressionFactory.get('operator').isA(value.as)) {
      value.as = { $object: value.as }
    }

    return {
      as: value.as === '$$ROOT' || value.as === Undefined
        ? Undefined
        : ExpressionFactory.guess(
          value.as,
          { parent: this, path: 'as' }
        ),
      in: isCustomName(value.in, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)
        ? value.in
        : new Pipeline().initialize(value.in, { parent: this, path: 'in' })
    }

  }

  async _next(ec, next) {
    return next
  }

  // input cursor is normal
  // output cursor is the custom pipeline result

  async _createInputCursor(ec, { input }) {

    const { as: expression } = this.value

    if (!expression) {

      return super._createInputCursor(ec, { input })

    } else {

      // the next item of the input cursor is used as root to evaluate the expression, and
      // then passed to the custom pipeline as root.
      const cursor = TypeFactory.create('Cursor').cast(input),
            inputCursor = await super._createOutputCursor(ec, { input: cursor }),
            _next = inputCursor._next

      inputCursor._next = callback => {

        _next.call(inputCursor, (err, next) => {

          if (err || next === Undefined) {
            return callback(err, Undefined)
          }

          ec.setVariable('$$ROOT', next)

          expression.evaluate(ec)
            .catch(e => {
              err = e
            })
            .then(result => {
              callback(err, result)
            })

        })
      }

      return inputCursor

    }

  }

  async _createOutputCursor(ec, { input }) {

    const { in: definition } = this.value,
          parent = ec

    if (definition instanceof Pipeline) {

      ec = new ExpressionContext({
        expression: definition,
        parent
      })

    } else {

      const { ac } = ec,
            { org } = ac,
            expression = await getRuntime(org, definition, { type: 'pipeline' })

      ec = new ExpressionContext({
        expression,
        variableScope: new VariableScope(expression),
        accessScope: new AccessScope(ac),
        depth: parent.depth,
        path: `${parent.getFullPath()}.in.${definition}`
      })

      parent.registerChildContext(expression.fullPath, ec)

    }

    return ec.evaluate({ input })

  }

}

module.exports = Stage$pipeline
