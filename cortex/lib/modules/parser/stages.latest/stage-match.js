/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      clone = require('clone'),
      config = require('cortex-service/lib/config'),
      modules = require('../../../modules'),
      ParserConsts = require('../parser-consts'),
      ParserStage = require('./stage'),
      ParserValues = require('../values'),
      ParserRules = require('../parse-rules'),
      ParserProperty = require('../property'),
      MatchTemplates = {},
      MatchOperators = {}

let Undefined

/**
 * Matching:
 *
 * - checks to ensure properties are allowed.
 */
class MatchStage extends ParserStage {

  constructor(parser) {
    super(parser)

    this._native_index_checks = []

  }

  parseOperator(key, value) {
    return new MatchRootExpression(this, value)
  }

  static get type() { return '$match' }

  static get indexable() { return true }

  flattenPaths() {
    const paths = []
    this.walk(true, false, component => {
      let propertyFullpath = component.propertyFullpath
      if (propertyFullpath && !~paths.indexOf(propertyFullpath)) {
        paths.push(propertyFullpath)
      }
    })
    return paths
  }

  parse(expression, options) {

    super.parse(expression, options)

    this._index_entries = {}
  }

  addNativeIndexCheck(component, node) {

    this._native_index_checks.push({ component, node })

  }

  validateNativeIndexes(json) {

    function find(branch, keys, search, depth = 0, found = {}) {
      for (const key of keys) {
        if (branch[key]) {
          if (search.includes(key)) {
            utils.flattenObjectPaths(branch[key])
            found[key] = (found[key] || (found[key] = [])).concat((object => {
              const list = []
              utils.visit(object, { fnObj: () => {}, fnVal: (val) => list.push(val) })
              return list
            })(branch[key]))
          }
          find(branch[key], _.without(keys, key), search, depth + 1, found)
        }
      }
      return found
    }

    if (this.usesIndex && this._native_index_checks.length && utils.isPlainObject(json)) {
      const covered = find(
        modules.db.definitions.getCollectionIndexes(this.parser.collection).tree,
        Object.keys(utils.flattenObjectPaths(json, false, true)),
        this._native_index_checks.map(({ component, node }) => node.fullpath)
      )
      this._native_index_checks.forEach(({ component, node }) => {
        if (!covered[node.fullpath]) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Matches can only occur on indexed properties. ' + node.fqpp + ' is either not indexed or is missing a preceding index key.', path: component.fullpath })
        }
      })
    }

  }

  _build() {

    const json = super._build()

    // compact indexed portion.
    let indexed = utils.walk(this._index_entries, true, true, (obj, currentKey, parentObject, currentIsArray) => obj)

    // ensure naturally indexed json includes baseFind to help prefixed index selections. querying by native indexes relies on this to validate index coverage.
    // here, we'll just add baseFind to every level that's missing it (anywhere inside $match, $and, and $or, and excluding any $elemMatch or $all)
    // if ((indexed || this._native_index_checks.length) && json.$match) {
    if (json.$match) {

      const base = clone(this.baseFind)
      for (const [key, value] of Object.entries(base)) {
        if (json.$match[key] === Undefined) {
          json.$match[key] = value
        }
      }
    }

    if (indexed) {

      // blow out branches. see addIndexEntries() for an explanation of why.
      // short version: slotted indexed values with matching natural name in multiple object types have different
      // real index names, so they have to be branched.
      let hasBranches = false,
          hasSlottedIndexValues = false

      utils.visit(
        indexed,
        {
          fnObj: (obj) => {

            if (obj.$branching_multi_keys) {

              hasBranches = true

              const base = clone(this.baseFind)
              if (obj.$or) {
                base.$or = obj.$or
              }
              obj.$or = []

              Object.keys(obj.$branching_multi_keys).forEach(key => {
                const entry = clone(base)
                entry[key] = obj.$branching_multi_keys[key]
                obj.$or.push(entry)
              })
              delete obj.$branching_multi_keys
            }
          },
          fnVal: (obj, currentKey, parentObject, parentIsArray, depth, fullPath) => {
            if (_.isString(fullPath) && fullPath.startsWith('idx.')) {
              hasSlottedIndexValues = true
            }
          }

        })

      if (hasBranches || hasSlottedIndexValues) {
        json[this.type] = { $and: [json[this.type], indexed] }
      } else {
        json[this.type] = indexed // all natural index. however, include the baseFind to entice the mongodb query planner to select the correct index.
      }

    }

    if (config('debug.outputMatchIndexes')) {
      console.log(JSON.stringify(json, null, 2)) // eslint-disable-line no-console
    }

    // check to ensure safe usage of natively indexed paths.
    this.validateNativeIndexes(json)

    return json
  }

  static get restrictedOperators() {

    if (!MatchStage._restricted) {
      MatchStage._restricted = Object.keys(MatchOperators).reduce((r, k) => { if (MatchOperators[k].restricted) { r.push(k) } return r }, [])
    }
    return MatchStage._restricted
  }

  isAllowedRestrictedOperator(operator) {
    const allowed = utils.array(utils.path(this.parser, 'ac.org.configuration.queries.allowedRestrictedMatchOps'))
    return _.intersection([operator, '*'], allowed).length > 0
  }

  addNaturalIndexEntries(component, value) {

    /*

    naturally indexed entry json is now modified with baseFind during _build() in order to better handle baseFind addition.

    // start with a named component. if we're in an $in, $gt, etc, move up
    while (component && !component.isRoot && component.isOperator) {
      component = component.parentComponent
    }

    utils.extend(this._index_entries, clone(component.stage.baseFind))
    this._index_entries[component.buildKey] = value
    */

  }

  addIndexEntries(component, isSlotted, ...keysAndValues) {

    const isMultiKeyed = keysAndValues.length > 2,
          lookingFor = ['$all', '$and', '$elemMatch', '$or'],
          chain = []

    // start with a named component. if we're in an $in, $gt, etc, move up
    while (component && !component.isRoot && component.isOperator) {
      component = component.parentComponent
    }

    // if there is no build key, use the natural property name of the closest real property name.
    for (let i = 0; i < keysAndValues.length; i += 2) {
      if (!keysAndValues[i]) {
        keysAndValues[i] = component.buildKey
      }
    }

    // build a branch from the conditional path of the selection.
    // break the component down into its path following each conditional (except $elemMatch, which is converted to $and)

    let parts,
        c = component
    while (c && !c.isRoot) {
      if (c.isOperator) {
        const key = c.key
        if (~lookingFor.indexOf(key)) {
          chain.push(c) // <-- $all and $elemMatch effectively become $and.
        }
      }
      c = c.parentComponent
    }
    chain.reverse()
    chain.push(component)

    parts = chain.reduce((parts, c, i) => {

      let key = (c.isOperator && c.key !== '$or') ? '$and' : c.key // <-- $all and $elemMatch effectively become $and.
      const last = chain[i - 1]
      if (last) {
        let p = c // <-- find the expression as the child of the next up the chain (we skip properties in between operators)
        while (p && p.parentComponent !== last) {
          p = p.parentComponent
        }
        if (p) {
          parts.push(p.parentExpression.listPosition)
        }
      }
      if (i < chain.length - 1) { // <-- don't add the property (we'll add the indexed value later). we are left with something like $and.0.$or.2
        parts.push(key)
      }
      return parts

    }, [])

    function addIndexEntry(entries, component, keysAndValues) {

      for (let index = 0; index < keysAndValues.length; index += 2) {
        let indexKey = keysAndValues[index],
            currentValue = entries[indexKey],
            insertValue = keysAndValues[index + 1]

        if (currentValue === Undefined || component.stage.baseFind[indexKey] !== Undefined) { // allow overriding base keys
          entries[indexKey] = insertValue
          ParserStage.fixMongoQueryParseCompoundSlotValueKeyParent(entries, indexKey)
        } else if ((utils.isPlainObject(currentValue) || utils.isPlainObject(insertValue))) {
          if (!(utils.isPlainObject(currentValue) && utils.isPlainObject(insertValue))) {
            throw Fault.create('cortex.invalidArgument.query', { reason: 'complex indexed expression could not be resolved.' })
          }
          Object.assign(currentValue, insertValue)
        } else if (!utils.deepEquals(currentValue, insertValue)) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'double indexed expression could not be resolved.' })
        }
      }
    }

    if (parts.length) {

      let current = this._index_entries
      parts.forEach(key => {
        if (!current[key]) {
          if (!utils.isInteger(key)) {
            current[key] = [] // to create an $or or $and path
          } else {
            current[key] = component.stage.baseFind // create the base find that includes all keys so mongodb can use indexes.
          }
        }
        current = current[key]
      })

      if (isMultiKeyed) {

        // we have to post-process these because branching can occur and interfere with natural $or statements.
        // say c_type_prop and c_another_type_prop are both indexed and are both in multiple types. they will have 4 branching indexes.
        /*
                {
                    $or: [{
                        $or: [{
                            c_prop: 1
                        }, {
                            c_prop: 2
                        }],
                        c_type_prop: 'unique',
                        c_another_type_prop: '1',
                        _id: { $gt: "000000000000000000000000"},

                    }, {
                        c_prop: 'xyz'
                    }]

                }
                */
        // if we then have c_prop in ther with another $or, what we want to do in the end is post process and create the branches with extra $and/$or entries...
        // leaving out the baseFind that we need, it should end up looking like this...
        /*
                {
                    $or: [{

                        $or: [{
                            'idx.c_another_type_prop.1': '1',
                            $or: [{
                                'idx.c_type_prop.1': 'unique',
                                $or: [{
                                    c_prop: 1
                                }, {
                                    c_prop: 2
                                }],
                            }, {
                                'idx.c_type_prop.2': 'unique',
                                $or: [{
                                    c_prop: 1
                                }, {
                                    c_prop: 2
                                }],
                            }]
                        }, {
                            'idx.c_another_type_prop.1': 1,
                            $or: [{
                                'idx.c_type_prop.1': 'unique',
                                $or: [{
                                    c_prop: 1
                                }, {
                                    c_prop: 2
                                }],
                            }, {
                                'idx.c_type_prop.2': 'unique',
                                $or: [{
                                    c_prop: 1
                                }, {
                                    c_prop: 2
                                }],
                            }]
                        }],
                        _id: { $gt: "000000000000000000000000"}
                    }, {
                        c_prop: 'xyz'
                    }]
                }
                */
        if (!current.$branching_multi_keys) {
          current.$branching_multi_keys = {}
        }
        current = current.$branching_multi_keys
        addIndexEntry(current, component, keysAndValues)
      } else {
        addIndexEntry(current, component, keysAndValues)
      }

    } else {

      if (isMultiKeyed) {
        if (!this._index_entries.$branching_multi_keys) {
          this._index_entries.$branching_multi_keys = {}
        }
        const entries = this._index_entries.$branching_multi_keys
        addIndexEntry(entries, component, keysAndValues)

      } else {
        const entries = this._index_entries
        for (let [key, value] of Object.entries(component.stage.baseFind)) {
          if (entries[key] === Undefined) {
            entries[key] = clone(value)
          }
        }
        addIndexEntry(entries, component, keysAndValues)
      }

    }

  }

}

ParserStage.register(MatchStage)

// ---------------------------------------------------------------------------------------------------------------------

class MatchExpression extends ParserValues.Expression {

  static get ComponentClass() {
    return MatchComponent
  }

  static validateProperty(component) {

    // find property.
    const property = component.property,
          usesIndex = component.stage.usesIndex

    if (!property) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Cannot match by unreconciled field.', path: component.fullpath })
    }

    // for now, references cannot be matched with non-references. the difficulty lies in manipulating the output match expression.
    let numReferences = 0

    property.nodes.forEach(node => {

      let n = node
      while (n && n !== n.root) {

        // authorize field use.
        ParserProperty.authorize(component, n, { bumpParserAccess: true }) // matching against non-readable values can lead to inferences.

        // cannot match virtual properties, or properties with custom readers
        if ((n.reader && !n.readerSearchOverride) || n.groupReader || n.virtual) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Matching cannot occur on properties not backed by concrete data (' + n.fqpp + ')', path: component.fullpath })
        }
        // if (n.getTypeName() === 'Any' && usesIndex) {
        //   throw Fault.create('cortex.invalidArgument.query', {reason: 'Matching cannot occur on Any types.', path: component.fullpath})
        // }

        n = n.parent
      }

      if (node.getTypeName() === 'Reference') {
        numReferences++
        component.markAsReference()
      }

      // only allow matching against primitives.
      if (component.parser.strict && !node.isPrimitive() && !(node.getTypeName() === 'Reference' || node.getTypeName() === 'Geometry' || node.getTypeName() === 'Any')) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Matches can only occur on primitives. A matched property is not compatible (' + node.getPublicTypeName() + '). Try narrowing the search to an object, type, or set which contains only primitives.', path: component.fullpath })
      }

      // if component match uses indexes, ensure it's indexed.
      if (usesIndex) {
        if (!node.nativeIndex && !node.indexed && !component.parser.unindexed) {

          // store up for post-check on native collection indexes
          component.stage.addNativeIndexCheck(component, node)

        }
        if (node.indexed) {
          const slot = _.find(node.root.slots, slot => utils.equalIds(slot._id, node._id))
          if (!slot) {
            throw Fault.create('cortex.error.unspecified', { reason: 'Match failed to load index for ' + node.fullpath, path: component.fullpath })
          }
        }
      }

    })

    // for now, references cannot be matched with non-references. the difficulty lies in manipulating the output match expression.
    // this will occur whether or not indexes are involved.
    if (numReferences > 0 && numReferences < property.nodes.length) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Matching cannot occur on a reference when mixed with other types. Consider matching by the reference _id or creating a common field that holds the referenced _id as an ObjectId.', path: this.fullpath })
    }

  }

  static matchModelsForObjectValue(value, candidateModels, comparator) {
    const name = value.underlyingValue, regexp = _.isRegExp(name)
    if (!(regexp && !comparator) && !_.isString(name)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$match object property must be a string or regexp', path: value.fullpath })
    }
    let found = candidateModels.reduce((found, model) => {
      if (regexp) {
        if (name.test(model.objectName)) {
          found.push(model)
        }
      } else if (comparator ? comparator(model.objectName, name) : model.objectName === name) {
        found.push(model)
      }
      return found
    }, [])
    if (found.length === 0 && value.parser.strict) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'strict: the object does exist in the list of candidates.', path: value.fullpath })
    }
    return found
  }

  static matchModelsForTypeValue(value, candidateModels, comparator) {
    let name = value.underlyingValue,
        isRegExp = _.isRegExp(name),
        isNullType = false,
        anyModelsAreTyped = false

    if (!(isRegExp && !comparator) && !_.isString(name) && !(isNullType = (name === null))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$match object property must be a string or regexp or null', path: value.fullpath })
    }

    const found = candidateModels.reduce((found, model) => {
      const node = model.schema.node
      if (node.typed || node.typeMasterNode) {
        anyModelsAreTyped = true
        if (isNullType) {
          if (node.typed) {
            if (!comparator || comparator(null, name)) {
              found.push(model)
            }
          }
        } else if (isRegExp) {
          if (name.test(model.objectTypeName)) {
            found.push(model)
          }
        } else if (comparator ? comparator(model.objectTypeName, name) : model.objectTypeName === name) {
          found.push(model)
        }
      } else if (node.properties.type) {
        // @todo get rid of this kludge by refactoring posts and comments as typed objects.
        // @todo @see https://github.com/Medable/MedableAPI/issues/281
        if (isRegExp && name.test(model.postType)) {
          found.push(model)
        } else if (comparator ? comparator(model.postType, name) : model.postType === name) {
          found.push(model)
        }
      }
      return found
    }, [])
    if (isNullType && !anyModelsAreTyped && this.parser.strict) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'strict: null type cannot be used where there are no typed candidate objects.', path: value.fullpath })
    }
    if (found.length === 0 && value.parser.strict) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'strict: the type does not exist in the list of candidate objects.', path: value.fullpath })
    }
    return found
  }

  resolveCandidateModels(candidateModels) {
    return _.intersection.apply(_, this.value.map(component => {
      const operator = component.operator
      if (operator) {
        if (operator.resolveCandidateModels) {
          return operator.resolveCandidateModels(component.value, candidateModels)
        }
      } else if (component.propertyFullpath === 'object') {
        switch (component.value.type) {
          case ParserConsts.Simple:
            return MatchExpression.matchModelsForObjectValue(component.value, candidateModels)
          case ParserConsts.Expression:
            return component.value.resolveCandidateModels(candidateModels)
          case ParserConsts.Variable:
            return candidateModels
          default:
            throw Fault.create('cortex.invalidArgument.query', { reason: '$match object property must be a simple value or an expression', path: component.fullpath })
        }
      } else if (component.propertyFullpath === 'type') {
        switch (component.value.type) {
          case ParserConsts.Simple:
            return MatchExpression.matchModelsForTypeValue(component.value, candidateModels)
          case ParserConsts.Expression:
            return component.value.resolveCandidateModels(candidateModels)
          case ParserConsts.Variable:
            return candidateModels
          default:
            throw Fault.create('cortex.invalidArgument.query', { reason: '$match type property must be a simple value or an expression', path: component.fullpath })
        }
      }
      return candidateModels
    }))
  }

  static matchPropertyNodesForSimpleValue(value, candidateModels, candidateProperties, comparator) {

    const component = value.parentComponent,
          fullPath = component.propertyFullpath,
          inputDiscriminatorValue = value.underlyingValue,
          isRegExp = _.isRegExp(inputDiscriminatorValue)

    // already exists in candidate properties? meaning it has already been shaved down? only use what's in the candidate properties.
    let property = _.find(candidateProperties, property => fullPath === property.propertyFullpath),
        // gather all nodes in all models that match the property name, adding it to the candidates list.
        candidateNodes = property ? property.nodes : _.values(candidateModels.reduce((nodes, model) => {
          return model.schema.node.findNodes(fullPath, [], { stopAt: (node) => node.getTypeName() === 'Any' }).reduce((nodes, node) => {
            const current = nodes[node.fqpp]
            if (!current || (current.root.typeMasterNode && !node.root.typeMasterNode)) {
              nodes[node.fqpp] = node.master || node
            }
            return nodes
          }, nodes)
        }, {})),
        resolvedNodes,
        hasDiscriminators = false,
        found = candidateNodes.reduce((found, node) => {
          const discriminatorKey = node.pathParent.discriminatorKey
          if (discriminatorKey) {

            hasDiscriminators = true

            const propDiscriminatorValue = node.parent.name

            if (node.name === discriminatorKey) {

              // the discriminator node itself. include nodes matching the name.
              if (!(isRegExp && !comparator) && !_.isString(inputDiscriminatorValue)) {
                throw Fault.create('cortex.invalidArgument.query', { reason: '$match discriminator property must be a string or regexp', path: value.fullpath })
              }
              if (isRegExp) {
                if (inputDiscriminatorValue.test(propDiscriminatorValue)) {
                  found.push(node)
                }
              } else if (comparator ? comparator(propDiscriminatorValue, inputDiscriminatorValue) : propDiscriminatorValue === inputDiscriminatorValue) {
                found.push(node)
              }

            } else {

              // this is a property of the discriminator. look for it in candidate properties.
              const discriminatorProperty = _.find(candidateProperties, property => node.parent.properties.name.fullpath === property.propertyFullpath)
              if (!discriminatorProperty) {
                // not limited
                found.push(node)
              } else {
                // get the nodes that match any one of the node names.
                const possibleNames = discriminatorProperty.nodes.map(node => node.parent.name)
                if (~possibleNames.indexOf(propDiscriminatorValue)) {
                  found.push(node)
                }
              }
            }

          } else {
            found.push(node)
          }
          return found
        }, [])
    resolvedNodes = (!hasDiscriminators || found.length === candidateNodes.length) ? candidateNodes : found
    if (resolvedNodes.length === 0 && value.parser.strict) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `strict: there are no properties that could match ${inputDiscriminatorValue} in ${component.stage.key} stage ${component.stage.listPosition}`, path: value.fullpath })
    }
    if (property && resolvedNodes === candidateNodes) {
      return candidateProperties
    } else {
      const source = property
      property = new ParserProperty(component.propertyFullpath, component, resolvedNodes, property ? property.isArray : undefined)
      return _.reject(candidateProperties, property => property === source).concat(property)
    }
  }

  resolveCandidateProperties(candidateModels, candidateProperties) {

    // merge properties and intersect nodes. nodes are whittled down when they are discriminators that encounter a limiting exrpession.
    return ParserProperty.mergeAndIntersectProperties(this.value.map(component => {

      const operator = component.operator

      if (operator) {

        if (operator.resolveCandidateProperties) {
          return operator.resolveCandidateProperties(component.value, candidateModels, candidateProperties)
        }

      } else {

        switch (component.value.type) {
          case ParserConsts.Simple:
          case ParserConsts.Variable:
            return MatchExpression.matchPropertyNodesForSimpleValue(component.value, candidateModels, candidateProperties)
          case ParserConsts.Expression:
            return component.value.resolveCandidateProperties(candidateModels, candidateProperties)
          default:
            throw Fault.create('cortex.invalidArgument.query', { reason: '$match type property must be a simple value or an expression', path: component.fullpath })
        }

      }

      return candidateProperties

    }))
  }

}

// ---------------------------------------------------------------------------------------------------------------------

class MatchRootExpression extends MatchExpression {

  get stage() {
    return this.parentComponent
  }

}

// ---------------------------------------------------------------------------------------------------------------------

class MatchComponent extends ParserValues.Component {

  parseField(field, value) {

    // @todo support array index searches?
    // normalize the path and make sure nothing funky was passed.
    if (field !== utils.normalizeObjectPath(field, false, true, true)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid field name: (' + field + ')', path: this.fullpath })
    }

    if (_.isArray(value)) {

      throw Fault.create('cortex.unsupportedOperation.exactMatching', { path: this.fullpath })

    } else if (utils.isPlainObject(value)) {

      const expression = new MatchExpression(this, value)
      if (expression.value.filter(component => !component.isOperator).length > 0) {
        throw Fault.create('cortex.unsupportedOperation.exactMatching', { path: this.fullpath })
      }
      return expression

    } else {

      const variable = this.stage.extractVariable(value)

      if (variable) {
        return new ParserValues.Variable(this, variable)
      } else {
        return new ParserValues.Simple(this, value)
      }
    }

  }

  static get operators() {
    return MatchOperators

  }

  validate() {

    if (this.isOperator) {
      if (this.value.type === ParserConsts.Variable) {
        return
      }
      return this.operator.validate(this)
    }

    switch (this.value.type) {

      case ParserConsts.Array:
        throw Fault.create('cortex.unsupportedOperation.exactMatching', { path: this.fullpath })

      case ParserConsts.Expression:
        // allow the expression to validate the property (it will reach into parents).
        this.value.validate()
        break

      case ParserConsts.Simple:
      case ParserConsts.Variable:
      case ParserConsts.Raw:

        MatchExpression.validateProperty(this)
        break

      default:
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Unknown match value type.', path: this.fullpath })
    }

  }

  build(intoExpression) {

    if (this.isOperator) {
      return this.operator.build(this, intoExpression)
    } else {
      switch (this.value.type) {
        case ParserConsts.Expression:
        case ParserConsts.Raw:
          const result = this.value.build()
          if (result instanceof ParserValues.Replacement) {
            return result.value
          } else if (result === undefined) {
            return undefined
          }
          return MatchComponent.checkIfLocalizedExpression(this, result) || { [this.buildKey]: result }

        case ParserConsts.Simple:
          return this.castIntoQuery(
            value => value,
            (values) => {
              return MatchComponent.checkIfLocalizedExpression(this, values) || { [this.buildKey]: values.length === 1 ? values[0] : { $in: values } }
            }
          )
        case ParserConsts.Array:
          throw Fault.create('cortex.unsupportedOperation.exactMatching', { path: this.fullpath })
        default:
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Unknown match value type.', path: this.fullpath })
      }
    }

  }

  /**
   * casts values into a query. some jiggery pokery may occur when indexes and references are involved.
   * @param fnFormat
   * @param fnValues
   * @param fnCaster -> ac, node, value
   */
  castIntoQuery(fnFormat, fnValues, fnCaster) {

    // handle index entries afterwords in order to account for nodes with non-shared slots
    // if similarly named properties both use indexes, none will match.
    // "idx.d.u1.v": "singular",
    // "idx.d.u4.v": "singular"
    // we have to turn the above into "$or": [{"idx.d.u1.v": "singular"}, {"idx.d.u4.v": "singular}]
    // in the chain.
    // so save them up until after processing.
    let slotIndexed

    const ac = this.parser.ac,
          stage = this.stage,
          value = this.value.underlyingValue,
          usesIndex = this.stage.usesIndex,
          isArray = this.value.type === ParserConsts.Array,
          nodes = this.property.nodes,
          values = nodes.reduce((values, node) => {

            const casted = isArray ? value.map(value => fnCaster ? fnCaster(ac, node, value) : node.castForQuery(ac, value)) : (fnCaster ? fnCaster(ac, node, value) : node.castForQuery(ac, value));

            // add the casted value to the list of resolved values
            (isArray ? casted : [casted]).forEach(casted => {
              if (values.filter(value => utils.deepEquals(casted, value), { strict: true }).length === 0) {
                values.push(casted)
              }
            })

            // insert an entry into the custom index match for each value.
            if (usesIndex) {
              if (node.indexed) {
                let indexKey = MatchStage.getExpressionKey(_.find(node.root.slots, slot => utils.equalIds(slot._id, node._id)))
                if (node.localized) {
                  indexKey += `.${this.parser.ac.getLocale()}`
                }
                (slotIndexed || (slotIndexed = [])).push(indexKey, fnFormat(casted))
              } else {
                // allow any field and detect validity of index coverage later on during the build process
                // } else if (node.nativeIndex) {
                // stage.addNaturalIndexEntries(this, fnFormat(casted))
                stage.addIndexEntries(this, false, null, fnFormat(casted))
              }
            }

            return values

          }, [])

    if (slotIndexed) {
      stage.addIndexEntries(this, true, ...slotIndexed)
    }

    return fnValues(values)

  }

  static checkIfLocalizedExpression(component, values, operator = '$in') {
    const nodes = component.getNodes
    if (nodes && _.find(nodes, ln => ln.localized)) {
      values = Array.isArray(values) ? values : [values]
      const expressionValue = values.length === 1 ? values[0] : { [operator]: values },
            locale = component.fixedLocale || component.parser.currentLocale
      if (nodes.length > 1) {
        const branches = []
        nodes.forEach((n) => {
          const typed = n.root.typeMasterNode && n.root.objectTypeName
          let extraCond
          if (typed) {
            extraCond = { 'type': typed }
          }
          if (n.localized) {
            branches.push({ [`locales.${component.propertyFullpath}`]: { $elemMatch: { 'value': expressionValue, locale } }, ...extraCond })
          } else {
            branches.push({ [component.propertyFullpath]: values, ...extraCond })
          }
        })
        return { $or: branches }
      }
      if (nodes[0].localized) {
        // using propertyFullpath since I have to move pointer to locales object
        return { [`locales.${component.propertyFullpath}`]: { $elemMatch: { 'value': expressionValue, locale } } }
      }
    }
    return null
  }

}

// ---------------------------------------------------------------------------------------------------------------------

Object.assign(MatchTemplates, {

  simple_or_variable: function(component, operator, value, variable) {

    if (variable) {
      return new ParserValues.Variable(component, variable)
    }
    return new ParserValues.Simple(component, value)
  },

  simple_or_property_or_variable_array: function(component, operator, value, variable) {

    if (variable) {
      return new ParserValues.Variable(component, variable)
    } else {
      return new ParserValues.Array(component, value, value => {
        ParserRules.valueMustBeSimpleOrPrimitive(component, operator, value)
        return MatchTemplates.simple_or_variable(component, operator, value)
      })
    }
  },

  arrayOfExpressions: function(component, operator, value, variable) {
    if (variable) {
      return new ParserValues.Variable(component, variable)
    }
    return new ParserValues.Array(component, value, value => {
      const variable = component.stage.extractVariable(value)
      if (variable) {
        return new ParserValues.Variable(component, variable)
      } else {
        return new MatchExpression(component, value)
      }
    })
  },

  expression: function(component, operator, value, variable) {
    if (variable) {
      return new ParserValues.Variable(component, variable)
    } else {
      return new MatchExpression(component, value)
    }
  },

  regex_or_variable: function(component, operator, pattern, variable) {

    if (variable) {
      return new ParserValues.Variable(component, variable)
    } else {
      const regexp = ParserRules.validateRegExp(component, pattern)
      return new ParserValues.Simple(component, regexp)
    }

  }

})

// ---------------------------------------------------------------------------------------------------------------------

function simpleOperatorModelResolver(value, operator, candidateModels, comparator) {
  if (value.type !== ParserConsts.Variable) {
    if (value.propertyFullpath === 'object') {
      if (value.type === ParserConsts.Simple) {
        return MatchExpression.matchModelsForObjectValue(value, candidateModels, comparator)
      }
      throw Fault.create('cortex.invalidArgument.query', { reason: operator + ' object property must be a simple value.', path: value.fullpath })
    } else if (value.propertyFullpath === 'type') {
      if (value.type === ParserConsts.Simple) {
        return MatchExpression.matchModelsForTypeValue(value, candidateModels, comparator)
      }
      throw Fault.create('cortex.invalidArgument.query', { reason: operator + ' type property must be a simple value.', path: value.fullpath })
    }
  }
  return candidateModels
}

function expressionOperatorModelResolver(value, operator, candidateModels) {
  if (value.type !== ParserConsts.Variable) {
    if (value.type === ParserConsts.Expression) {
      return value.resolveCandidateModels(candidateModels)
    }
  }
  return candidateModels
}

function createSimpleOperatorModelResolver(operator, comparator) {
  return function(value, candidateModels) {
    return simpleOperatorModelResolver(value, operator, candidateModels, comparator)
  }
}

function simpleOperatorPropertyResolver(value, operator, candidateModels, candidateProperties, comparator) {
  if (value.type !== ParserConsts.Variable) {
    if (value.type === ParserConsts.Simple) {
      return MatchExpression.matchPropertyNodesForSimpleValue(value, candidateModels, candidateProperties, comparator)
    }
    throw Fault.create('cortex.invalidArgument.query', { reason: operator + ' property must be a simple value.', path: value.fullpath })

  }
  return candidateProperties
}

function expressionOperatorPropertyResolver(value, operator, candidateModels, candidateProperties, comparator) {
  if (value.type !== ParserConsts.Variable) {
    if (value.type === ParserConsts.Expression) {
      return value.resolveCandidateProperties(candidateModels, candidateProperties)
    }
  }
  return candidateProperties
}

function createSimpleOperatorPropertyResolver(operator, comparator) {
  return function(value, candidateModels, candidateProperties) {
    return simpleOperatorPropertyResolver(value, operator, candidateModels, candidateProperties, comparator)
  }
}

function createSimpleOperatorPropertyBuilder(operator, caster = null) {
  return function(component, intoExpression) {
    return component.castIntoQuery(
      value => ({ [operator]: value }),
      (values) => {
        if (values.length === 1) {
          return { [operator]: values[0] }
        } else {
          // this is a typed node. this hack is a fix for multi-typed nodes with multiple expressions in a single field.
          if (Object.keys(intoExpression).length > 0 && !(intoExpression instanceof ParserValues.Replacement)) {
            throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
          }
          if (intoExpression instanceof ParserValues.Replacement && intoExpression.value.$or && intoExpression.value.$or.length === values.length) {
            values.forEach((value, index) => {
              const entry = intoExpression.value.$or[index],
                    buildKey = component.parentComponent.buildKey
              if (!entry[buildKey]) {
                entry[buildKey] = {}
              }
              entry[buildKey][operator] = value
            })
            return intoExpression
          }
          return new ParserValues.Replacement({ $or: values.map(value => ({ [component.parentComponent.buildKey]: { [operator]: value } })) })
        }
      },
      caster
    )
  }
}

Object.assign(MatchOperators, {

  $eq: {
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.valueMustBeSimpleOrPrimitiveOrEmpty
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$eq', (objectName, variableValue) => objectName > variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$eq', (discriminatorKey, discriminatorValue) => discriminatorKey > discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: createSimpleOperatorPropertyBuilder('$eq')
  },

  $type: {
    restricted: true,
    allowed_types: new Set('double string object array binData objectId bool date null regex int timestamp long decimal minKey maxKey'.split(' ')),
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      function(component, operator, value, variable) {
        if (!variable && !MatchOperators.$type.allowed_types.has(value)) {
          throw Fault.create('cortex.invalidArgument.query', { reason: `Operator ${operator} expects one of ${Array.from(MatchOperators.$type.allowed_types)}`, path: component.fullpath })
        }
      }
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$type', (objectName, variableValue) => objectName > variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$type', (discriminatorKey, discriminatorValue) => discriminatorKey > discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: function(component, intoExpression) {
      // this is a typed node. this hack is a fix for multi-typed nodes with multiple expressions in a single field.
      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }
      return { $type: component.value.build(intoExpression) }
    }
  },

  $exists: {
    restricted: false,
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      function(component, operator, value, variable) {
        if (!variable && !_.isBoolean(value)) {
          throw Fault.create('cortex.invalidArgument.query', { reason: `Operator ${operator} expects a boolean`, path: component.fullpath })
        }
      }
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$exists', (objectName, variableValue) => objectName > variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$exists', (discriminatorKey, discriminatorValue) => discriminatorKey > discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: createSimpleOperatorPropertyBuilder('$exists', (ac, node, value) => Boolean(value))
  },

  $ne: {
    restricted: true,
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.valueMustBeSimpleOrPrimitiveOrEmpty
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$ne', (objectName, variableValue) => objectName > variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$ne', (discriminatorKey, discriminatorValue) => discriminatorKey > discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: createSimpleOperatorPropertyBuilder('$ne')
  },

  $gt: {
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.valueMustBeSimpleOrPrimitiveOrEmpty
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$gt', (objectName, variableValue) => objectName > variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$gt', (discriminatorKey, discriminatorValue) => discriminatorKey > discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: createSimpleOperatorPropertyBuilder('$gt')
  },

  $gte: {
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.valueMustBeSimpleOrPrimitive
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$gte', (objectName, variableValue) => objectName >= variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$gte', (discriminatorKey, discriminatorValue) => discriminatorKey >= discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: createSimpleOperatorPropertyBuilder('$gte')
  },

  $lt: {
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.valueMustBeSimpleOrPrimitive
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$lt', (objectName, variableValue) => objectName < variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$lt', (discriminatorKey, discriminatorValue) => discriminatorKey < discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: createSimpleOperatorPropertyBuilder('$lt')
  },

  $lte: {
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.valueMustBeSimpleOrPrimitive
    ],
    parse: MatchTemplates.simple_or_variable,
    resolveCandidateModels: createSimpleOperatorModelResolver('$lte', (objectName, variableValue) => objectName <= variableValue),
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$lte', (discriminatorKey, discriminatorValue) => discriminatorKey <= discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: createSimpleOperatorPropertyBuilder('$lte')
  },

  $nin: {
    restricted: true,
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.mustBeArrayOfMax$inElements
    ],
    parse: function(component, operator, value, variable) {
      // $nin does not support {$regex: ""}, so convert to RegExp where possible
      if (!variable) {
        value = value.map(value => {
          if (utils.isPlainObject(value) && Object.keys(value).length === 1 && value.$regex !== undefined) {
            return ParserRules.validateRegExp(component, value.$regex)
          }
          return value
        })
      }
      return MatchTemplates.simple_or_property_or_variable_array(component, operator, value, variable)
    },
    resolveCandidateModels: (function() {
      const resolver = createSimpleOperatorModelResolver('$nin')
      return function(value, candidateModels) {
        if (value.type !== ParserConsts.Array) {
          throw Fault.create('cortex.invalidArgument.query', { reason: '$nin property expects an array', path: value.fullpath })
        }
        return _.uniq(_.union.apply(_, value.value.map(value => {
          return resolver(value, candidateModels)
        })))
      }
    }()),
    resolveCandidateProperties: (function() {
      const resolver = createSimpleOperatorPropertyResolver('$nin')
      return function(value, candidateModels, candidateProperties) {
        if (value.type !== ParserConsts.Array) {
          throw Fault.create('cortex.invalidArgument.query', { reason: '$nin property expects an array', path: value.fullpath })
        }
        return ParserProperty.mergeAndUnionProperties(value.value.map(value => {
          return resolver(value, candidateModels, candidateProperties)
        }))
      }
    }()),
    validate: function(component) {
      if (component.value.value.length > 0) {
        MatchExpression.validateProperty(component)
      }
    },
    build: function(component, intoExpression) {

      // this is a typed node. this hack is a fix for multi-typed nodes with multiple expressions in a single field.
      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }

      if (component.value.value.length > 0) {
        return component.castIntoQuery(
          value => ({ $nin: value }),
          values => ({ $nin: values })
        )
      }
      return { $nin: [] }
    }
  },

  $in: {
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch,
      ParserRules.mustBeArrayOfMax$inElements
    ],
    parse: function(component, operator, value, variable) {
      // $in does not support {$regex: ""}, so convert to RegExp where possible
      if (!variable) {
        value = value.map(value => {
          if (utils.isPlainObject(value) && Object.keys(value).length === 1 && value.$regex !== undefined) {
            return ParserRules.validateRegExp(component, value.$regex)
          }
          return value
        })
      }
      return MatchTemplates.simple_or_property_or_variable_array(component, operator, value, variable)
    },
    resolveCandidateModels: (function() {
      const resolver = createSimpleOperatorModelResolver('$in')
      return function(value, candidateModels) {
        if (value.type !== ParserConsts.Array) {
          throw Fault.create('cortex.invalidArgument.query', { reason: '$in property expects an array', path: value.fullpath })
        }
        return _.uniq(_.union.apply(_, value.value.map(value => {
          return resolver(value, candidateModels)
        })))
      }
    }()),
    resolveCandidateProperties: (function() {
      const resolver = createSimpleOperatorPropertyResolver('$in')
      return function(value, candidateModels, candidateProperties) {
        if (value.type !== ParserConsts.Array) {
          throw Fault.create('cortex.invalidArgument.query', { reason: '$in property expects an array', path: value.fullpath })
        }
        return ParserProperty.mergeAndUnionProperties(value.value.map(value => {
          return resolver(value, candidateModels, candidateProperties)
        }))
      }
    }()),
    validate: function(component) {
      if (component.value.value.length > 0) {
        MatchExpression.validateProperty(component)
      }
    },
    build: function(component, intoExpression) {

      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }

      if (component.value.value.length > 0) {
        return component.castIntoQuery(
          value => ({ $in: value }),
          values => {
            const localizedExpression = MatchComponent.checkIfLocalizedExpression(component.parentComponent, values)
            return localizedExpression ? new ParserValues.Replacement(localizedExpression) : { $in: values }
          }
        )
      }
      return { $in: [] }
    }
  },

  $and: {
    parse_rules: [
      ParserRules.mustBeTopLevelOrInside$orOr$andOr$elemMatch,
      ParserRules.mustBeArrayOfObjectsFromOneToMaxConditionsInLength
    ],
    parse: MatchTemplates.arrayOfExpressions,
    resolveCandidateModels: function(value, candidateModels) {
      if (value.type === ParserConsts.Variable) {
        return candidateModels
      }
      return _.intersection.apply(_, value.value.map(value => {
        return expressionOperatorModelResolver(value, '$and', candidateModels)
      }))
    },
    resolveCandidateProperties: function(value, candidateModels, candidateProperties) {
      if (value.type === ParserConsts.Variable) {
        return candidateProperties
      }
      return ParserProperty.mergeAndIntersectProperties(value.value.map(value => {
        return expressionOperatorPropertyResolver(value, '$and', candidateModels, candidateProperties)
      }))
    },
    validate: function(component) {
      component.value.value.forEach(value => value.validate())
    },
    build: function(component, intoExpression) {
      return { $and: component.value.build(intoExpression) }
    }
  },

  $or: {
    parse_rules: [
      ParserRules.mustBeTopLevelOrInside$orOr$andOr$elemMatch,
      ParserRules.mustBeArrayOfObjectsFromOneToMaxConditionsInLength
    ],
    parse: MatchTemplates.arrayOfExpressions,
    resolveCandidateModels: function(value, candidateModels) {
      if (value.type === ParserConsts.Variable) {
        return candidateModels
      }
      return _.uniq(_.union.apply(_, value.value.map(value => {
        return expressionOperatorModelResolver(value, '$or', candidateModels)
      })))
    },
    resolveCandidateProperties: function(value, candidateModels, candidateProperties) {
      if (value.type === ParserConsts.Variable) {
        return candidateProperties
      }
      return ParserProperty.mergeAndUnionProperties(value.value.map(value => {
        return expressionOperatorPropertyResolver(value, '$or', candidateModels, candidateProperties)
      }))
    },
    validate: function(component) {
      component.value.value.forEach(value => value.validate())
    },
    build: function(component, intoExpression) {
      return { $or: component.value.build(intoExpression) }
    }
  },

  $regex: {
    parse_rules: [
      ParserRules.upstreamMustBePropertyOr$allOr$elemMatch
    ],
    parse: MatchTemplates.regex_or_variable,
    resolveCandidateModels: (function() {
      return function(value, candidateModels) {
        if (value.type === ParserConsts.Variable) {
          return candidateModels
        }
        const regexp = ParserRules.validateRegExp(value.parentComponent, value.underlyingValue)
        return simpleOperatorModelResolver(value, '$regex', candidateModels, objectName => regexp.test(objectName))
      }
    }()),
    resolveCandidateProperties: (function() {
      return function(value, candidateModels, candidateProperties) {
        if (value.type === ParserConsts.Variable) {
          return candidateProperties
        }
        const regexp = ParserRules.validateRegExp(value.parentComponent, value.underlyingValue)
        return simpleOperatorPropertyResolver(value, '$regex', candidateModels, candidateProperties, discriminatorKey => regexp.test(discriminatorKey))
      }
    }()),
    validate: function(component) {

      // each node must be a string
      MatchExpression.validateProperty(component)
      component.property.nodes.forEach(node => {
        if (node.getPublicTypeName() !== 'String') {
          throw Fault.create('cortex.invalidArgument.query', { reason: '$regex can only occur against strings. A matched property is not compatible (' + node.fqpp + ').', path: component.fullpath })
        }
      })
    },
    build: function(component, intoExpression) {
      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }
      return component.castIntoQuery(
        value => value,
        (values) => {
          if (values.length === 1) {
            return { $regex: values[0] }
          } else {
            throw Fault.create('cortex.invalidArgument.query', { reason: '$regex cannot match against non-string properties.', path: component.fullpath })
          }
        }
      )
    }
  },

  $size: {
    parse_rules: [
      ParserRules.parentMustBeProperty
    ],
    parse: function(component, operator, value, variable) {

      if (variable) {
        return new ParserValues.Variable(component, variable)
      } else {
        if (!utils.isInt(value) || value < 0) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator $size expects an integer value >= 0.', path: component.fullpath })
        }
        return new ParserValues.Simple(component, value)
      }
    },
    resolveCandidateModels: function(value, candidateModels) { return candidateModels },
    resolveCandidateProperties: createSimpleOperatorPropertyResolver('$size', (discriminatorKey, discriminatorValue) => discriminatorKey > discriminatorValue),
    validate: MatchExpression.validateProperty,
    build: function(component, intoExpression) {
      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }
      return { $size: component.value.build(intoExpression) }
    }

  },

  $all: {
    parse_rules: [
      ParserRules.parentMustBeProperty
    ],
    parse: function(component, operator, value, variable) {

      if (variable) {
        return new ParserValues.Variable(component, variable)
      }

      if (!_.isArray(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator $all expects an array of values for property.', path: component.fullpath })
      }

      if ((!component.parser.relax && value.length > ParserConsts.MAX_$ALL_ELEMENTS)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator $all expects an array with a maximum of ' + ParserConsts.MAX_$ALL_ELEMENTS + ' values.', path: component.fullpath })
      }

      // we don't yet know if we're evaluating an array of primitives or an array of expressions. however, we know not to mix and match docs and primitives.
      let numSimple = 0, numExpressions = 0
      const rvalue = new ParserValues.Array(component, value, value => {
        const variable = component.stage.extractVariable(value)
        if (variable) {
          return new ParserValues.Variable(component, variable)
        } else if (_.isArray(value)) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator $all value cannot be an array', path: component.fullpath })
        } else if (utils.isPlainObject(value)) {
          numExpressions++
          const expression = new MatchExpression(component, value)
          if (expression.value.length !== 1 || expression.value.at(0).key !== '$elemMatch') {
            throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator $all expects $elemMatch values for property.', path: component.fullpath })
          }
          return expression
        } else {
          numSimple++
          return new ParserValues.Simple(component, value)
        }

      })

      if (numSimple > 0 && numExpressions > 0) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator $all value must either be all primitives or all $elemMatch objects, but not some of both.', path: component.fullpath })
      }

      return rvalue

    },
    resolveCandidateModels: function(value, candidateModels) {
      if (value.type === ParserConsts.Variable) {
        return candidateModels
      }
      return _.intersection.apply(_, value.value.map(value => {
        return expressionOperatorModelResolver(value, '$all', candidateModels)
      }))
    },
    resolveCandidateProperties: function(value, candidateModels, candidateProperties) {
      if (value.type === ParserConsts.Variable) {
        return candidateProperties
      }
      return ParserProperty.mergeAndIntersectProperties(value.value.map(value => {
        if (value.type === ParserConsts.Simple) {
          return MatchExpression.matchPropertyNodesForSimpleValue(value, candidateModels, candidateProperties)
        }
        return expressionOperatorPropertyResolver(value, '$all', candidateModels, candidateProperties)
      }))
    },
    validate: function(component) {
      let isSimple = false
      for (let i = 0, length = component.value.length; i < length; i++) {
        const value = component.value.at(i)
        if (value.type === ParserConsts.Simple) {
          isSimple = true
          break
        } else if (value.type === ParserConsts.Expression) {
          value.validate()
        }
      }
      if (isSimple) {
        MatchExpression.validateProperty(component)
      }
    },
    build: function(component, intoExpression) {
      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }
      return component.castIntoQuery(
        value => ({ $all: value }),
        values => {
          const localizedExpression = MatchComponent.checkIfLocalizedExpression(component, values, '$all')
          return localizedExpression ? new ParserValues.Replacement(localizedExpression) : { $all: values }
        })
    }
  },

  $elemMatch: {

    parse_rules: [
      ParserRules.parentMustBePropertyOr$all
    ],
    parse: MatchTemplates.expression,
    resolveCandidateModels: function(value, candidateModels) {
      return candidateModels
    },
    resolveCandidateProperties: function(value, candidateModels, candidateProperties) {

      if (value.type === ParserConsts.Variable) {
        return candidateProperties
      }

      // merge properties and intersect nodes. nodes are whittled down when they are discriminators that encounter a limiting expression.
      return ParserProperty.mergeAndIntersectProperties(value.value.map(component => {

        const operator = component.operator

        if (operator) {
          if (operator.resolveCandidateProperties) {
            return operator.resolveCandidateProperties(component.value, candidateModels, candidateProperties)
          }
        } else {
          switch (component.value.type) {
            case ParserConsts.Simple:
              return MatchExpression.matchPropertyNodesForSimpleValue(component.value, candidateModels, candidateProperties)
            case ParserConsts.Expression:
              return component.value.resolveCandidateProperties(candidateModels, candidateProperties)
            case ParserConsts.Variable:
              break
            default:
              throw Fault.create('cortex.invalidArgument.query', { reason: '$elemMatch property must be a simple value or an expression', path: component.fullpath })
          }
        }
        return candidateProperties

      }))
    },
    validate: function(component) {
      component.value.value.forEach(value => value.validate())
    },
    build: function(component, intoExpression) {
      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }
      function flatten(source, delimiter, filter) {
        var result = {}
        ;(function flat(obj, stack) {
          Object.keys(obj).forEach(function(k) {
            var s = stack.concat([k]),
                v = obj[k]
            if (filter && filter(k, v)) return
            if (typeof v === 'object') flat(v, s)
            else result[s.join(delimiter)] = v
          })
        })(source, [])
        return result
      }
      const values = component.value.build(),
            keys = Object.keys(flatten(values, '.')),
            localizedKeys = _.filter(keys, k => k.indexOf('locales.') > -1 && k.indexOf('$elemMatch.locale') < 0)
      if (localizedKeys.length > 0) {
        if (localizedKeys.length < keys.length && Object.keys(values).length > 1) {
          throw Fault.create('cortex.invalidArgument.query', {
            reason: 'Localized properties cannot be mixed with none localized properties on $elemMatch',
            path: component.fullpath
          })
        } else {
          return new ParserValues.Replacement(values)
        }
      }

      return { $elemMatch: values }
    }

  },

  $within: {

    parse_rules: [
      ParserRules.parentMustBeProperty,
      ParserRules.valueMustBeObject
    ],
    parse: function(component, operator, value, variable) {

      if (variable) {
        return new ParserValues.Variable(component, variable)
      }

      if (!modules.validation.isLngLat(value.$center)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + '.$center must be an array of 2 elements with valid lng and lat values', path: component.fullpath })
      }

      if (!utils.isNumeric(value.$radius) || value.$radius < 0) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + '.$radius must be a value in kilometers >= 0', path: component.fullpath })
      }

      value = {
        $centerSphere: [value.$center, value.$radius / 6378.1]
      }

      return new ParserValues.Simple(component, value)

    },
    resolveCandidateModels: function(value, candidateModels) {
      if (value.type === ParserConsts.Variable) {
        return candidateModels
      }
      return simpleOperatorModelResolver(value, '$within', candidateModels)
    },
    resolveCandidateProperties: function(value, candidateModels, candidateProperties) {
      if (value.type === ParserConsts.Variable) {
        return candidateProperties
      }
      return simpleOperatorPropertyResolver(value, '$within', candidateModels, candidateProperties)
    },

    validate: MatchExpression.validateProperty,

    build: function(component, intoExpression) {
      if (intoExpression instanceof ParserValues.Replacement) {
        throw Fault.create('cortex.unsupportedOperation.typedQueryExpression', { path: component.fullpath })
      }
      return component.castIntoQuery(
        value => ({ $geoWithin: value }),
        (values) => {
          return { $geoWithin: component.value.build(intoExpression) }
        }
      )
    }

  }

})
