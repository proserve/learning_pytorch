/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('../parser-consts'),
      ParserStage = require('./stage'),
      ParserValues = require('../values'),
      ParserProperty = require('../property')

class UnwindStage extends ParserStage {

  static get type() { return '$unwind' }

  static get indexable() { return false }

  normalize(expression) {

    if (_.isString(expression) && expression.match(/^[0-9a-z_.]+$/i)) {
      expression = {
        path: expression
      }
    }
    return super.normalize(expression)
  }

  parseOperator(key, value) {
    return new UnwindExpression(this, value)
  }

  flattenPaths() {
    const expression = this.value
    if (expression.type === ParserConsts.Expression) {
      return expression.value.map(component => component.underlyingValue)
    }
    return []
  }

}

ParserStage.register(UnwindStage)

// ---------------------------------------------------------------------------------------------------------------------

class UnwindExpression extends ParserValues.RootExpression {

  keysChecker(keys) {
    if (keys.length !== 1) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Unwinding must consist of a single path component', path: this.fullpath })
    }
  }

  static get ComponentClass() {
    return UnwindComponent
  }

  resolveCandidateProperties(candidateModels, candidateProperties) {

    return ParserProperty.mergeAndIntersectProperties(this.value.map(component => {

      if (component.value.type === ParserConsts.Variable) {
        return candidateProperties
      } else if (component.value.type !== ParserConsts.Property) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$unwind property must be a property name', path: component.fullpath })
      }

      const unwindFullpath = component.value.underlyingValue

      let candidateNodes,
          property = _.find(candidateProperties, property => unwindFullpath === property.propertyFullpath)

      // already exists in candidate properties?
      if (property) {
        if (property.isArray === false) {
          return candidateProperties
        } else {
          // we want to replace it.
          candidateProperties = _.without(candidateProperties, property)
          candidateProperties.push(new ParserProperty(unwindFullpath, component, property.nodes, false))
          return candidateProperties
        }
      }

      // gather all nodes in all models that match the property name, adding it to the candidates list.
      candidateNodes = _.values(candidateModels.reduce((nodes, model) => {
        return model.schema.node.findNodes(unwindFullpath, []).reduce((nodes, node) => {
          const current = nodes[node.fqpp]
          if (!current || (current.root.typeMasterNode && !node.root.typeMasterNode)) {
            nodes[node.fqpp] = node.master || node
          }
          return nodes
        }, nodes)
      }, {}))

      if (candidateNodes.length === 0 && component.parser.strict) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'strict: there are no properties that could be unwound.', path: component.fullpath })
      }
      return candidateProperties.concat(new ParserProperty(unwindFullpath, component, candidateNodes))

    }))

  }

}

// ---------------------------------------------------------------------------------------------------------------------

class UnwindComponent extends ParserValues.Component {

  parseField(field, value) {

    // only "path" is supported.
    if (field !== 'path') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid unwind property.', path: this.fullpath })
    }

    const variable = this.stage.extractVariable(value)

    if (variable) {
      return new ParserValues.Variable(this, variable)
    } else {
      if (value !== utils.normalizeObjectPath(value, true, true, true)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid $unwind property name: (' + value + ')', path: this.fullpath })
      }
      return new ParserValues.Property(this, value)
    }

  }

  get property() {
    if (!this._property) {
      const unwindPath = this.value.value
      this._property = _.find(this.properties, property => unwindPath === property.propertyFullpath)
    }
    return this._property
  }

  validate() {

    if (this.key !== 'path') {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid unwind property.', path: this.fullpath })
    }

    if (this.value.type === ParserConsts.Variable) {
      return
    }

    if (!this.property) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Cannot unwind by unreconciled field.', path: this.fullpath })
    }

    // even if there are custom readers, unwinding does not do any actual reading or transforming.
    // so anything that is concrete can be unwound. we'll generate a new property for the next stage.
    this.property.nodes.forEach(node => {
      let n = node
      while (n && n !== n.root) {
        ParserProperty.authorize(this, n, { bumpParserAccess: false })
        if (n.groupReader || n.virtual) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Unwinding cannot occur on properties not backed by concrete data (' + n.fqpp + ')', path: this.fullpath })
        }
        n = n.parent
      }

    })

  }

  build() {

    // note: use the natural key. if we ever support reference arrays, an 'isReference' build key would unwind the wrong property.
    const result = this.value.build()
    return result === undefined ? undefined : { [this.key]: result }
  }

}
