/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('../parser-consts'),
      ParserStage = require('./stage'),
      ParserValues = require('../values'),
      ParserRules = require('../parse-rules'),
      ParserProperty = require('../property'),
      PipelineExpression = require('../pipeline-expression'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        ParserModel: `${__dirname}/../model`
      }),
      GroupGenerators = {

        simple_accumulator: function(component, candidateModels, candidateProperties) {
          component.$__source_node = ParserProperty.generateNode(component.value, candidateModels, candidateProperties, null, null, null, PipelineExpression.Transformers.securedChildTransformer)
          return new ParserProperty.ProjectedNode({
            name: component.propertyName,
            type: 'Number',
            array: false,
            readAccess: component.$__source_node.readAccess,
            sourceComponent: component,
            sourceNodes: []
          })
        },

        tpl_secured_but_maybe_remain_connected: function(outputIsArray) {
          return function(component, candidateModels, candidateProperties) {
            // if there's a single source node, maybe we can read it out.
            return ParserProperty.generateNode(component.value, candidateModels, candidateProperties, null, null, null, PipelineExpression.Transformers.securedChildTransformer)
          }
        },

        tpl_secured_disconnected: function(outputIsArray) {
          return function(component, candidateModels, candidateProperties) {
            // secure all children. we'll have to read these out raw as a disconnected node. at this point, we will have no idea how to read the resulting value.
            const sourceNode = ParserProperty.generateNode(component.value, candidateModels, candidateProperties, null, null, null, PipelineExpression.Transformers.securedChildTransformer)
            return new ParserProperty.ProjectedNode({
              name: component.propertyName,
              type: sourceNode.getTypeName(),
              array: outputIsArray == null ? sourceNode.array : outputIsArray,
              readAccess: sourceNode.readAccess,
              sourceComponent: component,
              sourceNodes: [sourceNode]
            })
          }
        }

      },
      GroupAccumulators = {

        $count: {
          parse_rules: [ParserRules.valueMustBePropertyPath],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.simple_accumulator,
          build: function(component) {
            const build = component.value.build()
            if (component.$__source_node.array) {
              return new ParserValues.Replacement({ $sum: { $cond: [ { $isArray: build }, { $size: build }, 0 ] } })
            } else {
              return new ParserValues.Replacement({ $sum: { $cond: [ { $ifNull: [build, false] }, 1, 0 ] } })
            }
          }
        },

        $sum: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.simple_accumulator,
          build: PipelineExpression.Builders.buildNatural

        },

        $avg: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.simple_accumulator,
          build: PipelineExpression.Builders.buildNatural
        },

        $first: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.tpl_secured_but_maybe_remain_connected(),
          build: PipelineExpression.Builders.buildNatural

        },

        $last: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.tpl_secured_but_maybe_remain_connected(),
          build: PipelineExpression.Builders.buildNatural
        },

        $min: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.simple_accumulator,
          build: PipelineExpression.Builders.buildNatural
        },

        $max: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.simple_accumulator,
          build: PipelineExpression.Builders.buildNatural
        },

        $pushAll: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.tpl_secured_disconnected(true),
          build: function(component) {
            // a version of push that adds null values automatically to keep indexes gtg.
            const build = component.value.build()
            return new ParserValues.Replacement({ $push: { $ifNull: [build, false] } })
          }
        },

        $push: {
          allow_objects: true,
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.tpl_secured_disconnected(true),
          build: PipelineExpression.Builders.buildNatural
        },

        $addToSet: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.tpl_secured_disconnected(true),
          build: PipelineExpression.Builders.buildNatural
        },

        $stdDevPop: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.simple_accumulator,
          build: PipelineExpression.Builders.buildNatural
        },

        $stdDevSamp: {
          parse_rules: [ParserRules.valueMustBePropertyPathIfString],
          parse: PipelineExpression.Templates.simpleOrExpression,
          generator: GroupGenerators.simple_accumulator,
          build: PipelineExpression.Builders.buildNatural
        }

      }

// @todo group does not support inclusion style expressions

class GroupStage extends ParserStage {

  static get type() { return '$group' }

  static get indexable() { return false }

  normalize(expression) {

    if (_.isString(expression) && expression.match(/^[0-9a-z_]+$/i)) {
      expression = { _id: expression }
    }
    return super.normalize(expression)
  }

  parseOperator(key, value) {
    return new GroupRootExpression(this, value)
  }

  flattenPaths() {
    const paths = []
    this.walk(true, false, component => {
      const fullpath = component.fullpath
      if (fullpath && !~fullpath.indexOf('$') && !~paths.indexOf(fullpath)) {
        paths.push(fullpath)
      }
    })
    return paths
  }

  /**
     * building destroys everything. everything that gets accumulated will have to be completely stripped and will have no readers.
     */
  _build() {

    const group = this.value.build()

    if (!this.isRaw) {

      // try our best to include object.
      if (utils.path(group, '_id.object') === '$object') {
        group.object = { $first: '$object' }
      } else {
        const objectName = this.models[0].getSourceObjectName()
        if (objectName !== false) { // <-- "model" is what we get when we don't have any available typing information.
          group.object = { $first: { $literal: objectName } }
        }
      }

      // try to include type. types depend on object being present, because cross-object typing could lead to data leaks.
      if (group.object) {
        if (utils.path(group, '_id.type') === '$type') {
          group.type = { $first: '$type' }
        } else {
          const objectType = this.models[0].getSourceObjectType()
          if (objectType !== false) { // <-- "model" is what we get when we don't have any available typing information.
            group.type = { $first: { $literal: objectType } }
          }
        }
      }
    }

    return {
      $group: group
    }
  }

  get models() {
    if (!this._models || this._models.length === 0) {
      return super.models
      // return []
    }
    return this._models
  }

  get properties() {
    return []
  }

  validate() {

    const properties = [],
          candidateModels = this.isFirst ? this.parser.models : this.prev.models,
          candidateProperties = this.isFirst ? [] : this.prev.properties

    if (this.value.type === ParserConsts.Expression) {
      this.value.value.reduce((properties, component) => {
        properties.push(ParserProperty.generateNode(component.value, candidateModels, candidateProperties))
        return properties
      }, properties)
    }

    this._models = [lazy.ParserModel.create(this, properties)]
  }

}

ParserStage.register(GroupStage)

// ---------------------------------------------------------------------------------------------------------------------

class GroupRootExpression extends ParserValues.RootExpression {

  constructor(component, value) {

    // turn top-level dot paths into object early on.
    if (utils.isPlainObject(value)) {
      Object.keys(value).forEach(key => {
        if (~key.indexOf('.')) {
          utils.path(value, key, value[key])
          delete value[key]
        }
      })
    }

    super(component, value)

    const idComponent = this.value.filter(component => component.key === '_id')[0]
    if (!idComponent) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$group expression must contain an _id field' })
    }

    if (this.value.length === 1 && idComponent.underlyingValue === null) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Group component requires at least one expression when grouping by null' })
    }

  }

  static get ComponentClass() {

    return GroupRootComponent
  }

  build() {
    const result = this.value.reduce((expression, component) => {
      expression[component.key] = component.build()
      return expression
    }, {})

    return Object.keys(result).length ? result : undefined
  }

}

class GroupRootComponent extends ParserValues.Component {

  parseField(field, value) {

    if (!ParserConsts.FIELD_NAME_REGEX.test(field)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Top-level grouping must fields must match ' + ParserConsts.FIELD_NAME_REGEX, path: field })
    }
    if (field === '_id') {

      if (value == null) {
        return new ParserValues.Simple(this, null)
      } else if (_.isString(value)) {
        // value = {[value]: value};
      } else if (!utils.isPlainObject(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid group _id. Object expected.', path: '' })
      }

      return PipelineExpression.Templates.anyExpression(this, null, value, this.stage.extractVariable(value))
    }

    return new GroupAccumulatorExpression(this, value)
  }

  build() {
    if (this.isOperator) {
      return this.operator.build(this)
    } else {
      return this.value.build()
    }
  }

}

// ---------------------------------------------------------------------------------------------------------------------

class GroupAccumulatorExpression extends PipelineExpression {

  keysChecker(keys) {
    if (keys.length !== 1) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Group accumulator expression requires a single supported accumulator property', path: this.fullpath })
    }
  }

  static get ComponentClass() {
    return GroupAccumulatorComponent
  }

}

class GroupAccumulatorComponent extends PipelineExpression.PipelineComponent {

  static get operators() {
    return GroupAccumulators
  }

}
