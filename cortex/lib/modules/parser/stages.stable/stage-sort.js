/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('../parser-consts'),
      ParserStage = require('./stage'),
      ParserValues = require('../values'),
      ParserProperty = require('../property')

class SortStage extends ParserStage {

  static get type() { return '$sort' }

  static get indexable() { return true }

  normalize(expression) {

    if (_.isString(expression) && expression.match(/^[0-9a-z_]+$/i)) {
      expression = { [expression]: 1 }
    }

    return super.normalize(expression, expression => {
      if (Array.isArray(expression)) {
        const merged = {}
        expression.reduce((m, v) => Object.assign(merged, v), merged)
        expression = merged
      }
      return expression
    })
  }

  parseOperator(key, value) {
    return new SortExpression(this, value)
  }

  flattenPaths() {
    const expression = this.value
    if (expression.type === ParserConsts.Expression) {
      return expression.value.map(component => component.key)
    }
    return []
  }

}

ParserStage.register(SortStage)

// ---------------------------------------------------------------------------------------------------------------------

class SortExpression extends ParserValues.RootExpression {

  static get ComponentClass() {
    return SortComponent
  }

  resolveCandidateProperties(candidateModels, candidateProperties) {

    return ParserProperty.mergeAndIntersectProperties(this.value.map(component => {

      // already exists in candidate properties?
      let property = _.find(candidateProperties, property => component.propertyFullpath === property.propertyFullpath)

      if (property) {
        return candidateProperties
      }

      // gather all nodes in all models that match the property name, adding it to the candidates list.
      const candidateNodes = _.values(candidateModels.reduce((nodes, model) => {
        return model.schema.node.findNodes(component.propertyFullpath, []).reduce((nodes, node) => {
          const current = nodes[node.fqpp]
          if (!current || (current.root.typeMasterNode && !node.root.typeMasterNode)) {
            nodes[node.fqpp] = node.master || node
          }
          return nodes
        }, nodes)
      }, {}))

      if (candidateNodes.length === 0 && component.parser.strict) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'strict: there are no properties that could be sorted.', path: component.fullpath })
      }
      return candidateProperties.concat(new ParserProperty(component.propertyFullpath, component, candidateNodes))

    }))

  }

}

// ---------------------------------------------------------------------------------------------------------------------

class SortComponent extends ParserValues.Component {

  parseField(field, value) {

    // normalize the path and make sure nothing funky was passed.
    if (field !== utils.normalizeObjectPath(field, true, true, true)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid field name: (' + field + ')', path: this.fullpath })
    }

    const variable = this.stage.extractVariable(value)

    if (variable) {
      return new ParserValues.Variable(this, variable)
    } else {

      if (value !== 1 && value !== -1) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Sort value must be 1 for ascending, or -1 for descending order', path: this.fullpath })
      }
      return new ParserValues.Simple(this, value)
    }

  }

  validate() {

    // validate grouped and projected fields from the previous stage.
    // cannot have sort in the pipeline unless it is the first value, or there is first an upstream $group, $match

    if (!this.property) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Cannot sort by unreconciled field.', path: this.fullpath })
    }

    if (this.property.isArray) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Array sorting is unsupported.', path: this.fullpath })
    }

    // sorting across custom indexes cannot work unless they are shared.
    // sorting across custom indexes can never work cross-object.
    // native indexed fields can be sorted across objects, types and nodes.

    // index usage. sorting using indexes must employ the same index in each physical document.
    // because custom indexes use an internal field, sorting cannot occur even if field names match.
    // @todo index sharing can allow sorting across similarly named set properties

    this._index_slot = null // the node that will be used for internal index lookup
    this._index_slot = null // the node that will be used for internal index lookup

    let numReferences = 0,
        numNative = 0,
        numIndexed = 0

    const usesIndex = this.stage.usesIndex

    this.property.nodes.forEach(node => {

      // count refs to ensure we can conceivably sort due to ._id modifier.
      if (node.getTypeName() === 'Reference') {
        numReferences++
        this.markAsReference()
      }

      // cannot sort virtual properties, or properties with custom readers
      let n = node
      while (n && n !== n.root) {
        ParserProperty.authorize(this, n, { bumpParserAccess: true }) // sorting values can create inferences
        if ((n.reader && !n.readerSearchOverride) || n.groupReader || n.virtual) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Sorting cannot occur on properties not backed by concrete data (' + n.fqpp + ')', path: this.fullpath })
        }
        n = n.parent
      }

      // can only sort primitives (array sorting is okay, too!)
      if (!node.isPrimitive()) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Sorting can only occur on primitive values', path: this.fullpath })
      }

      // count index type usage to ensure we use compatible indexes.
      if (usesIndex) {
        if (node.nativeIndex) numNative++
        if (node.indexed) {
          numIndexed++
          const slot = _.find(node.root.slots, slot => utils.equalIds(slot._id, node._id))
          if (!slot) {
            throw Fault.create('cortex.error.unspecified', { reason: 'Sort failed to load index for ' + node.fullpath, path: this.fullpath })
          }
          if (!this._index_slot) {
            this._index_slot = slot
            this.isLocalized = node.localized
          } else if (this._index_slot !== slot) {
            throw Fault.create('cortex.invalidArgument.query', { reason: 'Sorting cannot occur across similarly named custom properties.', path: this.fullpath })
          }
        }
      }

    })

    // using compatible indexes?
    if (usesIndex) {
      if (numNative) {
        if (numNative < this.property.nodes.length) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Native properties can only sorted when they are all indexed.', path: this.fullpath })
        }
      } else if (numIndexed) {
        if (numIndexed > 1) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Sorting cannot occur across similarly named custom properties.', path: this.fullpath })
        }
      } else {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Sorting can only occur against indexed properties.', path: this.fullpath })
      }
    }

    // this is because sorting by a reference will convert it to ._id in the build phase. so they all have to be references
    // however, if sorting using a series of matching indices, we can allow it, since the index field is shared.
    if (numReferences > 0 && numReferences < this.property.nodes.length) {
      if (!this._index_slot) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Sorting cannot occur on a reference when mixed with other types. Consider sorting by the reference _id or creating a common field that holds the referenced _id as an indexed ObjectId.', path: this.fullpath })
      }
    }

    // validate the actual sorting value.
    if (this.value.type !== ParserConsts.Variable) {
      const v = this.value.value
      if (v !== 1 && v !== -1) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Sort value must be 1 for ascending, or -1 for descending order', path: this.fullpath })
      }
    }

  }

  build() {

    const value = this.value.build()
    let key = this.buildKey
    if (this._index_slot) {
      key = SortStage.getExpressionKey(this._index_slot)
      if (this.isLocalized) {
        const locale = this.parser.ac.getLocale()
        key = `${key}.${locale}`
      }
    }

    // if the node is indexed, sort by the internal index. here references are sorted by identifier, so no mod is required to the custom index key.
    // @todo this could also allow references and other properties to share a property index,
    return { [key]: value }
  }

}

// ---------------------------------------------------------------------------------------------------------------------
