/* eslint-disable no-use-before-define */

'use strict'

const utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserStage = require('./stage'),
      ParserConsts = require('../parser-consts'),
      ParserProperty = require('../property'),
      ProjectStage = require('./stage-project'),
      PipelineExpression = require('../pipeline-expression'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        ParserModel: `${__dirname}/../model`
      })

class AddFieldsStage extends ProjectStage {

  constructor(parser) {
    super(parser)
    this._expressions = []
  }

  static get reservedKeys() {
    return ['meta', 'idx', 'aclv', 'sequence', 'reap', 'favorites', 'facets']
  }

  static get type() { return '$addFields' }

  _build() {
    this._expressions.forEach((exp) => {
      this.value.appendExpression(exp)
    })
    const project = utils.flattenProjection(this.value.build())

    return {
      $addFields: project
    }
  }

  parseOperator(key, value) {
    return new AddFieldsRootExpression(this, value)
  }

  validate() {

    const properties = [],
          candidateModels = this.isFirst ? this.parser.models : this.prev.models,
          candidateProperties = this.isFirst ? [] : this.prev.properties

    candidateModels.forEach((cm) => {
      Object.keys(cm.schema.node.properties).forEach((k) => {
        const prop = cm.schema.node.properties[k]
        try {
          this.addToExpression(k, properties, candidateModels, candidateProperties)
        } catch (e) {
          // do nothing
        }
        if (prop.readable && !prop.optional) {
          this._expressions.push({ [k]: k })
        }
      })
    })

    if (['$project', '$group'].indexOf(this.prev.key) > -1) {
      this._expressions = []
      const expr = this.prev.value.build()
      Object.keys(expr).forEach((k) => {
        if (expr[k]) {
          this._expressions.push({ [k]: `${k}` })
        }
      })
    }

    if (this.value.type === ParserConsts.Expression) {
      this.value.value.reduce((properties, component) => {
        const node = ParserProperty.generateNode(component.value, candidateModels, candidateProperties)
        properties.push(node)
        return properties
      }, properties)
    }

    if (!this.isRaw) {

      const model = lazy.ParserModel.create(this, properties)
      this._models = [model]
    }

  }

  addToExpression(k, properties, candidateModels, candidateProperties) {
    const expression = new AddFieldsRootExpression(this, { [k]: k })
    expression.value.reduce((properties, component) => {
      const node = ParserProperty.generateNode(component.value, candidateModels, candidateProperties)
      properties.push(node)
    }, properties)
  }

}

class AddFieldsRootExpression extends PipelineExpression {

  constructor(component, value) {

    // turn top-level dot paths into object early on.
    if (utils.isPlainObject(value)) {
      Object.keys(value).forEach(key => {
        if (~key.indexOf('.')) {
          utils.path(value, key, value[key])
          delete value[key]
        }
        if (AddFieldsStage.reservedKeys.indexOf(key) > -1) {
          throw Fault.create('cortex.invalidArgument.query', { reason: `${key} cannot be used as key` })
        }
      })
    }

    super(component, value)

  }

  get stage() {
    return this.parentComponent
  }

  appendExpression(expression) {
    const key = Object.keys(expression)[0],
          value = expression[key],
          expComponent = new this.constructor.ComponentClass(this)
    expComponent.parse(key, value)
    if (this.value.filter(p => p.key === key).length < 1) {
      this.value.push(expComponent)
    }
  }

}

ParserStage.register(AddFieldsStage)
