/* eslint-disable no-use-before-define */

'use strict'

/**
 * @todo support direct array creation.
 */

const _ = require('underscore'),
      utils = require('../../utils'),
      { isSet } = utils,
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../acl'),
      ParserConsts = require('./parser-consts'),
      ParserValues = require('./values'),
      ParserProperty = require('./property'),
      ParserRules = require('./parse-rules'),
      SelectionTree = require('../db/definitions/classes/selection-tree'),
      PipelineBuilders = {},
      PipelineGenerators = {},
      PipelineTransformers = {},
      PipelineOperators = {}

// ---------------------------------------------------------------------------------------------------------------------

class PipelineExpression extends ParserValues.Expression {

  constructor(component, value) {

    super(component, value)

    const isTopLevel = this.isTopLevel,
          counts = this.value.reduce((counts, component) => {
            if (component.key[0] === '$') {
              ++counts.num_operators
            } else if (!(isTopLevel && component.fullpath === '_id') || component.underlyingValue) { // top level id only counts if it's included.
              counts.num_fields++
            }
            return counts
          }, { num_operators: 0, num_fields: 0 })

    if (counts.num_fields === 0 && counts.num_operators === 0) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$project stage requires at least one output field' })
    }
    if (counts.num_operators > 1 || (counts.num_operators === 1 && counts.num_fields > 0)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'operator expressions cannot mix field names with operators', path: this.fullpath })
    }

  }

  static get ComponentClass() {
    return PipelineComponent
  }

  static get PipelineComponent() {
    return PipelineComponent
  }

  static get Templates() {
    return ParserTemplates
  }

  static get Builders() {
    return PipelineBuilders
  }

  static get Generators() {
    return PipelineGenerators
  }

  static get Transformers() {
    return PipelineTransformers
  }

  build() {
    const result = this.value.reduce((expression, component) => {
      const result = component.build()
      if (result instanceof ParserValues.Replacement) {
        if (result.value instanceof ParserValues.Replacement) {
          expression = result.value
        } else {
          _.extend(expression, result.value)
        }
      } else if (result !== undefined) {
        expression[component.key] = result
      }
      return expression
    }, {})

    return Object.keys(result).length ? result : undefined
  }

}

// ---------------------------------------------------------------------------------------------------------------------

class PipelineComponent extends ParserValues.Component {

  static get operators() {
    return PipelineOperators
  }

  parseField(field, value) {

    const isTopLevel = this.isTopLevel

    if (!ParserConsts.FIELD_NAME_REGEX.test(field)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'pipeline expression field names must match ' + ParserConsts.FIELD_NAME_REGEX, path: this.fullpath })
    }

    // we now allow this but only under certain circumstances.
    // if (~this.fullpath.indexOf('$')) {
    //    throw Fault.create('cortex.invalidArgument.unspecified', {reason: 'pipeline expression field names cannot occur within an operator expression', path: this.fullpath});
    // }

    // top-level id cannot be excluded due to possible dependencies.
    if (isTopLevel && field === '_id' && this.stage.key !== '$addFields') {
      if (value === 1 || value === true) {
        return new ParserValues.Simple(this, value) // < -- projecting the field.
      }
      throw Fault.create('cortex.invalidArgument.query', { reason: 'pipeline expression _id field can only be 1 or true.' })
    }

    // just throw out excluded fields instead of complaining.
    if (value === 0 || value === false || value === null) {
      return undefined
    }

    let variable = this.stage.extractVariable(value),
        parsed = ParserTemplates.anyExpression(this, null, value, variable)

    if (parsed.type === ParserConsts.Simple) {
      if (!(parsed.underlyingValue === 1 || parsed.underlyingValue === true)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'pipeline field values must be inclusions (1 or true), property projections (c_field), or expressions ({$sum: "c_value"}).', path: this.fullpath })
      }
    }
    return parsed
  }

  parseOperator(key, value) {
    if (this.isTopLevel) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'pipeline expressions do not support operators at the top level.', path: this.fullpath })
    }
    return super.parseOperator(key, value)
  }

  get models() {
    return this.stage.isFirst ? this.parser.models : this.stage.prev.models
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

class ParserTemplates {

  constructor() {
    throw new Error('unusable class')
  }

  static simpleOrExpression(component, operator, value, variable) {
    if (variable) {
      return new ParserValues.Variable(component, variable)
    } else if (utils.isPlainObject(value)) {
      return new PipelineExpression(component, value)
    } else if (_.isString(value) && value.length > 0) {
      if (value[0] !== '$') {
        return new ParserValues.Property(component, value)
      } else if (value[1] === '$') {
        throw Fault.create('cortex.unsupportedOperation.query', { reason: 'pipeline aggregation variables are unsupported.', path: component.fullpath })
      }
    } else if (_.isArray(value)) {
      // return ParserTemplates.arrayOfExpressions(component, operator, value, variable);
      throw Fault.create('cortex.unsupportedOperation.query', { reason: 'array values are unsupported here.', path: component.fullpath })
    }
    return new ParserValues.Simple(component, value)
  }

  static arrayOfExpressions(component, operator, value, variable) {
    if (variable) {
      return new ParserValues.Variable(component, variable)
    }
    return new ParserValues.Array(component, value, value => {
      return ParserTemplates.anyExpression(component, operator, value, component.stage.extractVariable(value))
    })
  }

  static anyExpression(component, operator, value, variable) {
    if (variable) {
      return new ParserValues.Variable(component, variable)
    } else if (_.isArray(value)) {
      return new ParserValues.Array(component, value, value => {
        return ParserTemplates.anyExpression(component, operator, value, component.stage.extractVariable(value))
      })
    } else if (utils.isPlainObject(value)) {
      return new PipelineExpression(component, value)
    } else if (_.isString(value) && value.length > 0) {
      if (value[0] !== '$') {
        return new ParserValues.Property(component, value)
      }
      return new PipelineExpression(component, { $literal: value })
      // else if (value[1]==='$') {
      //   throw Fault.create('cortex.unsupportedOperation.unspecified', {reason: 'pipeline aggregation variables are unsupported.', path: component.fullpath});
      // }
    }
    return new ParserValues.Simple(component, value)
  }

  static dateOrSimpleOrExpression(component, operator, value, variable) {
    if (!variable) {
      if (_.isString(value) && value.length > 0 && value[0] !== '$') {
        const date = utils.getValidDate(value)
        if (date) {
          value = date
        }
      }
    }
    return ParserTemplates.simpleOrExpression(component, operator, value, variable)
  }

  static tplLiteralTransform(fn) {
    return function(component, operator, value, variable) {
      component.key = '$literal'
      if (variable) {
        return new ParserValues.Variable(component, variable)
      }
      return new ParserValues.Simple(component, fn(component, operator, value, variable))
    }
  }

}

Object.assign(PipelineBuilders, {

  // convert our internal literals.
  buildLiteral: function(component) {
    return component.underlyingValue
  },

  buildNatural: function(component) {
    return PipelineBuilders.transformBuiltLocalizedProps(component, component.value.build())
  },

  buildDateOrNull: function(component) {
    const value = component.value.build()
    return new ParserValues.Replacement({ $cond: [{ $ifNull: [value, false] }, { [component.key]: value }, null] })
  },

  transformBuiltLocalizedProps: function(component, values) {

    if (_.isArray(values)) {
      return _.map(values, v => PipelineBuilders.checkLocalized(component, v) || v)
    }
    return PipelineBuilders.checkLocalized(component, values) || values
  },

  checkLocalized(component, v) {
    const sourceNodes = component.build_sourceNodes,
          sn = _.filter(sourceNodes, sc => _.isString(v) && sc.fullpath === v.replace('$', ''))
    if (sn.length && sn[0].localized) {
      const str = v.replace('$', '')
      return {
        $let: {
          vars: {
            localize: {
              $arrayElemAt: [{
                $filter: {
                  input: `$locales.${str}`,
                  as: 'loc',
                  cond: {
                    $eq: ['$$loc.locale', sn[0].localization.fixed || component.parser.currentLocale]
                  }
                }
              }, 0]
            }
          },
          in: {
            $concat: ['$$localize.value', '']
          }
        }
      }
    }
    return null
  }

})

Object.assign(PipelineGenerators, {

  generateLiteral: function(component, candidateModels, candidateProperties) {
    return new ParserProperty.ProjectedNode({
      name: component.propertyName,
      type: component.value.naturalNodeType,
      array: component.value.isNaturalArray,
      readAccess: acl.AccessLevels.None,
      sourceComponent: component,
      sourceNodes: [] // <-- no known source nodes
    })
  },

  /**
     *
     * @param outputNodeTypeName
     * @param inputNodeTypeName
     * @param forceOutputNodeToArray
     * @param expectingComponentNodeToBeArray
     * @param transformer called with resulting property
     */
  tplGenerateProperty: function(outputNodeTypeName, inputNodeTypeName, forceOutputNodeToArray, expectingComponentNodeToBeArray, transformer) {
    return function(component, candidateModels, candidateProperties) {
      const outputNode = ParserProperty.generateNode(component.value, candidateModels, candidateProperties, outputNodeTypeName, inputNodeTypeName, expectingComponentNodeToBeArray, transformer)
      if (isSet(forceOutputNodeToArray)) {
        outputNode.array = forceOutputNodeToArray
      }
      return outputNode
    }
  },

  tplGenerateHardTypedProperty: function(outputNodeTypeName, inputNodeTypeName, forceOutputNodeToArray, expectingComponentNodeToBeArray, transformer) {
    return function(component, candidateModels, candidateProperties) {
      const outputNode = ParserProperty.generateNode(component.value, candidateModels, candidateProperties, null, inputNodeTypeName, expectingComponentNodeToBeArray, transformer)
      outputNode._typeName = outputNodeTypeName
      if (isSet(forceOutputNodeToArray)) {
        outputNode.array = forceOutputNodeToArray
      }
      return outputNode
    }
  },

  tplGenerateFromSecuredArrays: function(outputNodeTypeName, outputIsArray) {
    return function(component, candidateModels, candidateProperties) {
      const inputs = component.value.value.map(value => {
        return ParserProperty.generateNode(value, candidateModels, candidateProperties, null, null, true, PipelineTransformers.securedChildTransformer)
      })
      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: outputNodeTypeName,
        array: outputIsArray,
        sourceComponent: component,
        sourceNodes: inputs
      })
    }
  }

})

Object.assign(PipelineTransformers, {

  // this transformer does not authorize children, so the generator MUST check for type.
  opaqueValueTransformer: function(outputNode, component, candidateModels, candidateProperties, outputType, isArray) {

    if (_.isArray(outputNode)) {
      const sourceNodes = outputNode,
            readAccess = sourceNodes.reduce((readAccess, node) => Math.max(readAccess, node.readAccess), acl.AccessLevels.None)
      outputNode = new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: outputType,
        array: isArray,
        sourceComponent: component,
        readAccess: readAccess,
        sourceNodes: sourceNodes
      })
    }
    if (outputNode.hasReader) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '"' + component.key + '" cannot select on a property not backed by concrete data (' + outputNode.source_nodes_with_readers.map(n => n.fqpp).join(', ') + '). try matching the property out of projection candidacy.', path: component.fullpath })
    }
    return outputNode

  },

  // it may be possible to leak information from a comparison within a document (from a literal object, for example), so any document children
  // must be authorized, and must all be concrete values, because all typing is lost if unknown.
  // them out is still possible unless they become an unknown type. this permits projections of possibly opaque documents to be properly read.
  securedChildTransformer: function(outputNode, component, candidateModels, candidateProperties, outputType, isArray) {

    outputNode = PipelineTransformers.opaqueValueTransformer(outputNode, component, candidateModels, candidateProperties, outputType, isArray)
    outputNode.authorize_for_projection_amalgamation()
    return outputNode
  }

})

// ---------------------------------------------------------------------------------------------------------------------

Object.assign(PipelineOperators, {

  // accumulators (not the same as top-level group accumulators) -----------------------------------------------------
  $sum: {
    parse_rules: [ParserRules.valueMustBePropertyPathIfString],
    parse: ParserTemplates.anyExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $avg: {
    parse_rules: [ParserRules.valueMustBePropertyPathIfString],
    parse: ParserTemplates.anyExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $max: {
    parse_rules: [ParserRules.valueMustBePropertyPathIfString],
    parse: ParserTemplates.anyExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $min: {
    parse_rules: [ParserRules.valueMustBePropertyPathIfString],
    parse: ParserTemplates.anyExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $stdDevPop: {
    parse_rules: [ParserRules.valueMustBePropertyPathIfString],
    parse: ParserTemplates.anyExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $stdDevSamp: {
    parse_rules: [ParserRules.valueMustBePropertyPathIfString],
    parse: ParserTemplates.anyExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  // literals --------------------------------------------------------------------------------------------------------

  $literal: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value) {
      return value
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $string: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      if (!_.isString(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$string expects a string value.', path: component.fullpath })
      }
      return value
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $number: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      if (!utils.isNumeric(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$number expects a number value.', path: component.fullpath })
      }
      return parseFloat(value)
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $integer: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      if (!utils.isInteger(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$integer expects an integer value.', path: component.fullpath })
      }
      return parseInt(value)
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $boolean: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      if (!_.isBoolean(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$boolean expects a boolean value.', path: component.fullpath })
      }
      return !!value
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $date: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      value = utils.getValidDate(value)
      if (!value) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$date expects a date value.', path: component.fullpath })
      }
      return value
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $objectId: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      value = utils.getIdOrNull(value)
      if (!value) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$objectId expects an ObjectId value.', path: component.fullpath })
      }
      return value
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $array: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      if (!_.isArray(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$array expects an array value.', path: component.fullpath })
      }
      return value
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  $object: {
    parse: ParserTemplates.tplLiteralTransform(function(component, operator, value, variable) {
      if (!utils.isPlainObject(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$object expects an object value.', path: component.fullpath })
      }
      return value
    }),
    generator: PipelineGenerators.generateLiteral,
    build: PipelineBuilders.buildLiteral
  },

  // booleans --------------------------------------------------------------------------------------------------------

  $and: {
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $or: {
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $not: {
    pre: function(component, operator, value, variable) {
      return utils.array(value, true)
    },
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(1)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  // sets ------------------------------------------------------------------------------------------------------------

  $setEquals: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfAtLeastSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateFromSecuredArrays('Boolean', false),
    build: PipelineBuilders.buildNatural
  },

  $setIntersection: {
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateFromSecuredArrays(),
    build: PipelineBuilders.buildNatural
  },

  $setUnion: {
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateFromSecuredArrays(),
    build: PipelineBuilders.buildNatural
  },

  $setDifference: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateFromSecuredArrays(),
    build: PipelineBuilders.buildNatural
  },

  $setIsSubset: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateFromSecuredArrays('Boolean', false),
    build: PipelineBuilders.buildNatural
  },

  $anyElementTrue: {
    pre: function(component, operator, value, variable) {
      return utils.array(value, true)
    },
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, true, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  $allElementsTrue: {
    pre: function(component, operator, value, variable) {
      return utils.array(value, true)
    },
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, true, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  // comparison ------------------------------------------------------------------------------------------------------

  $cmp: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', null, false, null, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  $eq: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  $gt: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  $gte: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  $lt: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  $lte: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  $ne: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Boolean', null, false, null, PipelineTransformers.securedChildTransformer),
    build: PipelineBuilders.buildNatural
  },

  // conditional -----------------------------------------------------------------------------------------------------

  $cond: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(3)
    ],
    parse: ParserTemplates.anyExpression,
    generator: function(component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray) {

      // validate if, then and else. return the output nodes as an unknown document.
      const cond = ParserProperty.generateNode(component.value.value.at(0), candidateModels, candidateProperties, 'Boolean', null, null, PipelineTransformers.securedChildTransformer),
            possibleResults = [
              ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, null, null, null, PipelineTransformers.securedChildTransformer),
              ParserProperty.generateNode(component.value.value.at(2), candidateModels, candidateProperties, null, null, null, PipelineTransformers.securedChildTransformer)
            ],
            outputNode = PipelineTransformers.opaqueValueTransformer(possibleResults, component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray)
      outputNode.bumpReadAccess(cond.readAccess)
      return outputNode
    },
    build: PipelineBuilders.buildNatural
  },

  $ifNull: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.anyExpression,
    generator: function(component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray) {

      // validate if, then and else. return the output nodes as an unknown document.
      const possibleResults = [
        ParserProperty.generateNode(component.value.value.at(0), candidateModels, candidateProperties, null, null, null, PipelineTransformers.securedChildTransformer),
        ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, null, null, null, PipelineTransformers.securedChildTransformer)
      ]
      return PipelineTransformers.opaqueValueTransformer(possibleResults, component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray)
    },
    build: PipelineBuilders.buildNatural
  },

  // arithmetic ------------------------------------------------------------------------------------------------------

  $trunc: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $sqrt: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $ln: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $floor: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $exp: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $ceil: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $abs: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $add: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfAtLeastSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: function(component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray) {

      let numDates = 0
      component.value.value.forEach(value => {
        const input = ParserProperty.generateNode(value, candidateModels, candidateProperties, null, null, false, PipelineTransformers.securedChildTransformer),
              typeName = input.getTypeName()
        if (typeName === 'Date') {
          numDates++
          if (numDates > 1) {
            throw Fault.create('cortex.invalidArgument.query', { reason: '$add expression only supports a single date value.', path: component.fullpath })
          }
        } else if (typeName !== 'Number' && component.parser.strict) {
          throw Fault.create('cortex.invalidArgument.query', { reason: '$add expected a Number or Date but got a "' + typeName + '"', path: component.fullpath })
        }
      })

      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: numDates ? 'Date' : 'Number',
        array: false,
        sourceComponent: component,
        sourceNodes: []
      })

    },
    build: PipelineBuilders.buildNatural
  },

  $multiply: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfAtLeastSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, true, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $subtract: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: function(component, candidateModels, candidateProperties) {

      const inputs = [
              ParserProperty.generateNode(component.value.value.at(0), candidateModels, candidateProperties, null, null, false, PipelineTransformers.securedChildTransformer),
              ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, null, null, false, PipelineTransformers.securedChildTransformer)
            ],
            types = inputs.map(input => input.getTypeName())

      if (!((types[0] === 'Date' && types[1] === 'Date') || (types[0] === 'Number' && types[1] === 'Number') || (types[0] === 'Date' && types[1] === 'Number'))) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '$subtract expects Date/Date, Number/Number or Date/Number but got "' + types[0] + '/' + types[1] + '"', path: component.fullpath })
      }

      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: types[0] === types[1] ? 'Number' : 'Date',
        array: false,
        sourceComponent: component,
        sourceNodes: []
      })

    },
    build: PipelineBuilders.buildNatural
  },

  $divide: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, true, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $mod: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, true, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $pow: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, true, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $log: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateProperty('Number', 'Number', false, true, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  // strings ---------------------------------------------------------------------------------------------------------

  $concat: {
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateProperty('String', 'String', false, true, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $substr: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(3)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: function(component, candidateModels, candidateProperties) {
      // validate and secure input, then output a string node with correct read access. here, we don't need sources because the output is a new node.
      const inputs = [
        ParserProperty.generateNode(component.value.value.at(0), candidateModels, candidateProperties, null, ['String', 'Number', 'Date'], false, PipelineTransformers.securedChildTransformer),
        ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, null, 'Number', false, PipelineTransformers.securedChildTransformer),
        ParserProperty.generateNode(component.value.value.at(2), candidateModels, candidateProperties, null, 'Number', false, PipelineTransformers.securedChildTransformer)
      ]

      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: 'String',
        array: false,
        readAccess: inputs.reduce((readAccess, node) => Math.max(readAccess, node.readAccess), acl.AccessLevels.None),
        sourceComponent: component,
        sourceNodes: []
      })
    },
    build: PipelineBuilders.buildNatural
  },

  $toLower: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('String', 'String', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $toUpper: {
    parse: ParserTemplates.simpleOrExpression,
    generator: PipelineGenerators.tplGenerateProperty('String', 'String', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $strcasecmp: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    _generator: PipelineGenerators.tplGenerateProperty('Number', 'String', false, true, PipelineTransformers.opaqueValueTransformer),
    generator: function(component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray) {
      const inputs = [
        ParserProperty.generateNode(component.value.value.at(0), candidateModels, candidateProperties, null, 'String', false, PipelineTransformers.opaqueValueTransformer),
        ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, null, 'String', false, PipelineTransformers.opaqueValueTransformer)
      ]
      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: 'Number',
        array: false,
        readAccess: inputs.reduce((readAccess, node) => Math.max(readAccess, node.readAccess), acl.AccessLevels.None),
        sourceComponent: component,
        sourceNodes: [] // <-- break from originals. this is now an unrelated projection.
      })
    },
    build: PipelineBuilders.buildNatural
  },

  // arrays ----------------------------------------------------------------------------------------------------------

  $size: {
    parse: ParserTemplates.simpleOrExpression,
    generator: function(component, candidateModels, candidateProperties) {
      const outputNode = ParserProperty.generateNode(component.value, candidateModels, candidateProperties, 'Number', null, true)
      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: 'Number',
        array: false,
        readAccess: outputNode.readAccess,
        sourceComponent: component,
        sourceNodes: [] // <-- break from the source. here, it's safe to include subdocuments because we only want the opaque array size.
      })
    },
    build: PipelineBuilders.buildNatural
  },

  $slice: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfLengthBetween(2, 3)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: function(component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray) {
      // slice only secures the node at the top-level.
      const inputs = [
        ParserProperty.generateNode(component.value.value.at(0), candidateModels, candidateProperties, null, null, true, PipelineTransformers.opaqueValueTransformer),
        ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, 'Number', 'Number', false, PipelineTransformers.securedChildTransformer)
      ]
      if (component.value.value.length === 3) {
        inputs.push(ParserProperty.generateNode(component.value.value.at(2), candidateModels, candidateProperties, null, 'Number', false, PipelineTransformers.securedChildTransformer))
      }
      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: outputTypeName,
        array: true,
        readAccess: inputs.reduce((readAccess, node) => Math.max(readAccess, node.readAccess), acl.AccessLevels.None),
        sourceComponent: component,
        sourceNodes: [inputs[0]] // <-- use the original as the source.
      })
    },
    build: PipelineBuilders.buildNatural

  },

  $isArray: {
    pre: function(component, operator, value, variable) {
      return utils.array(value, true)
    },
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(1)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateProperty('Boolean', null, false, null, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildNatural
  },

  $concatArrays: {
    parse_rules: [
      ParserRules.mustBeArray
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: PipelineGenerators.tplGenerateFromSecuredArrays(),
    build: PipelineBuilders.buildNatural
  },

  $arrayElemAt: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfSize(2)
    ],
    parse: ParserTemplates.arrayOfExpressions,
    generator: function(component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray) {
      const inputs = [
        ParserProperty.generateNode(component.value.value.at(0), candidateModels, candidateProperties, null, null, true, PipelineTransformers.opaqueValueTransformer),
        ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, null, 'Number', false, PipelineTransformers.securedChildTransformer)
      ]
      return new ParserProperty.ProjectedNode({
        name: component.propertyName,
        type: outputTypeName,
        array: expectingComponentNodeToBeArray, // <-- unknown. will cause a leak into mongodb error "The argument to $size must be an Array, but was of type: XXX"
        readAccess: inputs.reduce((readAccess, node) => Math.max(readAccess, node.readAccess), acl.AccessLevels.None),
        sourceComponent: component,
        sourceNodes: [inputs[0]] // <-- use the original as the source.
      })
    },
    build: PipelineBuilders.buildNatural
  },

  /*
    _$filter: {
        parse_rules: [
            ParserRules.tplMustBeArrayOfSize(2)
        ],
        parse: ParserTemplates.arrayOfExpressions
        // filter adds legal $$ to variable checking.
        // only allow a single level and strip and authorize all children for variable
    },
    */

  // dates -----------------------------------------------------------------------------------------------------------

  $dayOfYear: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $dayOfMonth: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $dayOfWeek: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $year: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $month: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $week: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $hour: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $minute: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $second: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $millisecond: {
    parse: ParserTemplates.dateOrSimpleOrExpression,
    generator: PipelineGenerators.tplGenerateHardTypedProperty('Number', 'Date', false, false, PipelineTransformers.opaqueValueTransformer),
    build: PipelineBuilders.buildDateOrNull
  },

  $dateToString: {
    parse_rules: [
      ParserRules.tplMustBeArrayOfLengthBetween(2, 3)
    ],
    parse: function(component, operator, value) {
      let idx = 0
      return new ParserValues.Array(component, value, value => {
        const variable = component.stage.extractVariable(value)
        let result
        if (idx === 0 || idx === 2) {
          if (!_.isString(value)) {
            throw Fault.create('cortex.invalidArgument.query', { reason: '$dateToString format must be a string [format, date_expression]', path: component.fullpath })
          } else if (variable) {
            result = new ParserValues.Variable(component, variable)
          }
          result = new ParserValues.Raw(component, value)
        } else {
          result = ParserTemplates.dateOrSimpleOrExpression(component, operator, value, component.stage.extractVariable(value))
        }
        idx++
        return result
      })
    },
    generator: function(component, candidateModels, candidateProperties, outputTypeName, expectingComponentNodeToBeArray) {
      const outputNode = ParserProperty.generateNode(component.value.value.at(1), candidateModels, candidateProperties, null, 'Date', expectingComponentNodeToBeArray, PipelineTransformers.securedChildTransformer)
      outputNode._typeName = 'String'
      return outputNode
    },
    build: function(component) {
      let output = {
        format: component.value.value.at(0).build(),
        date: component.value.value.at(1).build()
      }
      const tz = component.value.value.at(2)
      if (tz) {
        Object.assign(output, {
          timezone: tz.build()
        })
      }
      return output
    }
  },

  /*

    */

  // variables -------------------------------------------------------------------------------------------------------

  /*
    $map: {
    },
    */

  /*
    $let: {
    }
    */

  // text search -----------------------------------------------------------------------------------------------------

  /*
     $meta: {
     }
     */

  // custom ----------------------------------------------------------------------------------------------------------

  $expand: {

    isCustomOperator: true,

    parse: function(component, operator, value, variable) {
      if (component.stage.type !== '$project' && component.stage.type !== '$addFields') {
        throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: 'Invalid operator $expand', path: component.fullpath })
      }
      if (variable) {
        return new ParserValues.Variable(component, variable)
      } else if (value === 1 || value === true) {
        return new ParserValues.Simple(component, true) // simple expansion
      } else if (_.isArray(value)) {
        value.forEach(path => {
          if (!_.isString(path)) {
            throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: '$expand as an array expects an array or string properties', path: component.fullpath })
          }
        })
        return new ParserValues.Simple(component, value) // paths array
      } else if (utils.isPlainObject(value)) {
        return new ParserValues.Simple(component, value) // projection object.
      }
      throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: '$expand expects 1/true, and array of paths, or a projection object.', path: component.fullpath })
    },

    customize: function(outputNode, customComponent) {

      const component = outputNode.sourceComponent

      // $expand is only useful in the last projection stage of a pipeline.
      let stage = component.stage.isLast ? component.stage : component.stage.next
      while (!stage.isLast) {
        if (stage.type === '$group' || stage.type === '$unwind') {
          throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: '$expand must appear in the last transformational stage (' + stage.type + ' ' + stage.listPosition + ')', path: component.fullpath })
        }
        stage = stage.next
      }

      if (outputNode.getTypeName() === 'Reference') {
        if (outputNode.array) {
          throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: '$expand cannot be applied to Reference arrays', path: component.fullpath })
        }
        if (!outputNode.isExpandable()) {
          throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: 'Expansion not allowed for ' + outputNode.sourceNodes.filter(node => !node.expandable).map(node => node.fqpp), path: component.fullpath })
        }
        outputNode.runtimeProcessor = (ac, node, doc, selection) => this.process_reference(node, selection, customComponent.underlyingValue)
      } else if (outputNode.getPublicTypeName() === 'Reference[]') {
        if (!utils.isPlainObject(customComponent.underlyingValue)) {
          throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: 'Using $expand with a Reference[] or List requires an object property with list arguments (pipeline, limit, etc...)', path: component.fullpath })
        }
        outputNode.runtimeProcessor = (node, principal, entries, req, script, selection) => this.process_list(node, selection, customComponent.underlyingValue)

      } else {
        throw Fault.create('cortex.invalidArgument.illegalExpansion', { reason: '$expand cannot be applied to References and Reference[] (List properties)', path: component.fullpath })
      }
      return outputNode

    },

    build: function(component) {
      // return the proper replacement when $addFields
      if (component.parentComponent.parentExpression.parentComponent.key === '$addFields') {
        return new ParserValues.Replacement(new ParserValues.Replacement({ [component.parentComponent.key]: `$${component.parentComponent.key}` }))
      }
      // from a build perspective, we're only projecting the reference.
      return new ParserValues.Replacement(new ParserValues.Replacement({ [component.parentComponent.key]: 1 }))

    },

    process_reference: function(node, selection, args) {

      const options = {
              parent: selection,
              nodeFilter: selection.nodeFilter,
              ignoreMissing: selection.ignoreMissing
            },
            referencePropertyNames = Object.keys(node.properties)

      if (args === 1 || args === true) {
        // natural expansion without selections. select all default paths. to ensure the selection didn't select anything strange, reset the selections.
        const sel = new SelectionTree(options)
        sel.expand = true
        sel.pathOverride = selection.pathOverride
        return sel
      }

      if (_.isArray(args)) {

        // only expand if desired paths include ones not available in the reference node.
        options.paths = args
        if (!~args.indexOf('_id')) {
          args.push('_id')
        }
        const sel = new SelectionTree(options)
        sel.expand = (args.length > 0 && _.difference(args || [], referencePropertyNames).length > 0)
        sel.pathOverride = selection.pathOverride
        return sel
      }

      // if there are any paths selected beyond the referencePropertyNames or anything exists in there that's more complex that a simple path selection, force an expansion.
      let projection = {},
          expand = false,
          forceProjection = false,
          sel

      Object.keys(args).forEach(path => {
        const value = args[path]
        if (path === '_id') {
          if (value !== 1 && value !== true) {
            throw Fault.create('cortex.invalidArgument.query', { reason: '$expand _id property must equal 1 or true', path: node.fqpp })
          }
        }
        if (value) {
          projection[path] = value
          if (!~referencePropertyNames.indexOf(path)) {
            expand = true
            if (value !== 1 && value !== true) {
              forceProjection = true
            }
          }
        }
      })
      projection._id = true // <-- alwayd for the _id, on which the expansion queue depends.

      if (forceProjection) {
        options.projection = projection
      } else {
        options.paths = Object.keys(projection)
        if (options.paths.length === 0) {
          options.paths.push('_id')
        }
      }
      sel = new SelectionTree(options)
      sel.expand = expand
      sel.pathOverride = selection.pathOverride
      return sel

    },

    process_list: function(node, selection, args) {
      const options = {
        parent: selection,
        nodeFilter: selection.nodeFilter,
        ignoreMissing: selection.ignoreMissing,
        projection: args
      }
      return new SelectionTree(options)
    }
  }

})

module.exports = PipelineExpression
