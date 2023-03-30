/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      { isSet, array: toArray, path: pathTo, pathParts } = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../acl'),
      modules = require('../../modules'),
      PropertyDefinition = require('../db/definitions/property-definition'),
      AnyDefinition = require('../db/definitions/types/any-definition'),
      DocumentDefinition = require('../db/definitions/types/document-definition'),
      ParserConsts = require('./parser-consts'),
      PRIMITIVES = ['Date', 'String', 'Number', 'Boolean', 'ObjectId'],
      ProjectedNodeMixin = {},
      ProjectedNodeProperties = {}

class ParserProperty {

  constructor(propertyFullpath, sourceComponent, nodes, isArray) {
    this._propertyFullpath = propertyFullpath
    this._sourceComponent = sourceComponent
    this._nodes = toArray(nodes, !!nodes)
    this._isArray = isArray
  }

  /**
     * the component from which this property was created.
     */
  get sourceComponent() {
    return this._sourceComponent
  }

  get propertyFullpath() {
    return this._propertyFullpath
  }

  /**
     * the property's stage.
     */
  get stage() {
    return this._sourceComponent.stage
  }

  /**
     * the current parser instance.
     */
  get parser() {
    return this._sourceComponent.parser
  }

  /**
     * the list of definition nodes that apply to this property.
     */
  get nodes() {
    return this._nodes
  }

  /**
     * should the property be treated as an array.
     */
  get isArray() {
    return this._isArray
  }

  /**
     * computes and return max readAccess of all component nodes.
     */
  get readAccess() {
    if (!isSet(this._readAccess)) {
      this._readAccess = acl.fixAllowLevel(_.max(this.nodes.map(node => node.readAccess)), true)
    }
    return this._readAccess
  }

  equals(other) {

    if (other === this) return true
    if ((other instanceof ParserProperty)) {
      if (other._isArray === this._isArray &&
                other._is_projected === this._is_projected &&
                other._sourceComponent.propertyFullpath === this._sourceComponent.propertyFullpath &&
                other.nodesEqual(this._nodes)) {
        return true
      }
    }
    return false
  }

  nodesEqual(nodes) {
    if (_.isArray(nodes)) {
      if (nodes === this._nodes) {
        return true
      }
      if (nodes.length === this._nodes.length) {
        for (let i = 0, il = nodes.length; i < il; i++) {
          const a = nodes[i]
          if (!~this._nodes.indexOf(a)) {
            return false
          }
        }
        return true
      }
    }
    return false
  }

  intersectionOrThis(other) {
    if (this === other) {
      return this
    } else if (this.propertyFullpath !== other.propertyFullpath) {
      throw Fault.create('cortex.unsupportedOperation.query', { reason: 'property intersections can only be made on identical paths', path: this.propertyFullpath })
    } else if (this.isArray !== other.isArray) {
      throw Fault.create('cortex.unsupportedOperation.query', { reason: 'mismatched property array setting in unsupported', path: this.propertyFullpath })
    } else if (this.nodesEqual(other._nodes)) {
      return this
    } else {
      return new ParserProperty(this.propertyFullpath, this._sourceComponent, _.intersection(this._nodes, other._nodes), this._isArray)
    }
  }

  unionOrThis(other) {
    if (this === other) {
      return this
    } else if (this.propertyFullpath !== other.propertyFullpath) {
      throw Fault.create('cortex.unsupportedOperation.query', { reason: 'property intersections can only be made on identical paths', path: this.propertyFullpath })
    } else if (this.isArray !== other.isArray) {
      throw Fault.create('cortex.unsupportedOperation.query', { reason: 'mismatched property array setting in unsupported', path: this.propertyFullpath })
    } else if (this.nodesEqual(other._nodes)) {
      return this
    } else {
      return new ParserProperty(this.propertyFullpath, this._sourceComponent, _.union(this._nodes, other._nodes), this._isArray)
    }
  }

  get hasReader() {
    if (!isSet(this._hasReader)) {
      let hasReader = false
      for (let node of this.nodes) {
        if (node.reader && !node.readerSearchOverride) {
          hasReader = true
          break
        }
      }
      this._hasReader = hasReader
    }
    return this._hasReader
  }

  static mergeAndUnionProperties(arraysOfProperties) {
    return _.values(arraysOfProperties.reduce((result, properties) => {
      return properties.reduce((result, property) => {
        let existing = result[property.propertyFullpath]
        if (!existing) {
          result[property.propertyFullpath] = property
          return result
        } else {
          result[property.propertyFullpath] = existing.unionOrThis(property)
        }
        return result
      }, result)
    }, {}))
  }

  static mergeAndIntersectProperties(arraysOfProperties) {
    return _.values(arraysOfProperties.reduce((result, properties) => {
      return properties.reduce((result, property) => {
        let existing = result[property.propertyFullpath]
        if (!existing) {
          result[property.propertyFullpath] = property
          return result
        } else {
          result[property.propertyFullpath] = existing.intersectionOrThis(property)
        }
        return result
      }, result)
    }, {}))
  }

  static authorize(component, node, options) {

    const bumpParserAccess = options && options.bumpParserAccess

    if (!node.readable) {
      throw Fault.create('cortex.notFound.property', { path: node.fullpath })
    }

    // some pipeline stages might skip acl, such as internal preMatch and preSort for lists.
    if (!component.stage.skipAcl) {

      // some nodes cannot have any subsequent transformations are not susceptible to to inference attacks. for those,
      // non-targeted access control doesn't apply because the only time it's resolved is at runtime. also, bumping acl
      // access isn't required; the projected node will always retain it's original access control qualities.
      if (node.getTypeName() === 'List') {

        // no op.

      } else {

        // non-targeted acl entries (self, owner, creator) cannot be immediately resolved. as such, disallow searching.
        if (node.acl.filter(function(entry) { return !entry.target }).length) {
          throw Fault.create('cortex.unsupportedOperation.query', { reason: 'Operation is not available for properties with custom non-targeted acl entries.', path: node.fullpath })
        }

        if (node.acl.length === 0) {

          // in straight projection, we don't need to bump access because there is no matching.
          // in comparisons, though, we do. in projections, we may bump access on the node itself.

          if (bumpParserAccess) {
            // bump up the top level access required. this is to prevent a result set that, even though it does not contain the field,
            // has allowed the caller to know the value in the document that matches the query. to plug the hole, ensure the entire query
            // now runs using an increased level of access.
            component.parser.bumpAccessLevel(node.readAccess)
          }

        } else {

          // resolve direct access to the property. the top level access query still guards against reading the property
          // if no access is granted to the context. here, however, we have an augmented acl. if there is enough access to read the property,
          // silently allow it. if not, throw an access denied error.

          // find the right model object.
          const model = _.find(component.models, model => {
            return node.root === model.schema.node || node.root === model.schema.node.typeMasterNode
          })

          if (!model) {
            throw Fault.create('cortex.notFound.propertyModel', { reason: 'Property model not found.', path: node.fullpath })
          } else {
            const ac = component.parser._ac.object === model ? component.parser._ac.object : (ac => { ac.object = model; return ac })(component.parser._ac.copy())
            if (!node.hasReadAccess(ac)) {
              throw Fault.create('cortex.accessDenied.inaccessibleProperty', { path: node.fqpp })
            }
          }
        }

      }

    }

    // disallow any properties that require system access.
    if (!component.parser._allowSystemAccess && node.readAccess === acl.AccessLevels.System) {
      throw Fault.create('cortex.notFound.property', { path: node.fullpath })
    }

    component.parser._nodeAuthorized(node, component)

  }

  static get ProjectedNode() {
    return ProjectedNode
  }

  static get ProjectedDocument() {
    return ProjectedDocument
  }

  static generateNode(value, candidateModels, candidateProperties, outputNodeTypeName, inputNodeTypeName, expectingComponentNodeToBeArray, transformer) {

    const component = value.parentComponent,
          expressionOperator = (value.type === ParserConsts.Expression && value.value.at(0).isOperator) ? value.value.at(0).operator : null,
          customOperator = (expressionOperator && expressionOperator.isCustomOperator) ? expressionOperator : null,
          valueType = customOperator ? ParserConsts.Simple : value.type,
          _t = function(input) {
            if (_.isFunction(transformer)) {
              const output = transformer(input, component, candidateModels, candidateProperties, outputNodeTypeName, expectingComponentNodeToBeArray)
              return output || input
            }
            return input
          }

    if (modules.db.mongoose.Schema.reserved[component.propertyFullpath]) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'The property name "' + component.propertyFullpath + '" is reserved.', path: component.fullpath })
    }

    let outputNode

    switch (valueType) {

      case ParserConsts.Variable:

        // whether the variable is part of an expression or a projected field, the value cannot be known. return expected type.
        // at this point, we don't even know what the source nodes might be, so we return a projected node.
        outputNode = new ProjectedNode({
          name: component.propertyName,
          type: outputNodeTypeName || toArray(inputNodeTypeName, !!inputNodeTypeName)[0] || 'Unknown',
          array: expectingComponentNodeToBeArray,
          readAccess: acl.AccessLevels.None,
          sourceComponent: component,
          sourceNodes: [] // <-- no known source nodes
        })
        break

      case ParserConsts.Property:
      case ParserConsts.Simple:

        const isSimple = valueType === ParserConsts.Simple,
              inOperator = ~component.fullpath.indexOf('$')

        // sanity check. do not allow field paths below an operator.
        // -- this is now allowed.
        // if (inOperator && !component.isOperator) {
        //    throw Fault.create('cortex.invalidArgument.unspecified', {reason: 'field path cannot be contained is a pipeline operator', path: component.fullpath});
        // }

        // simple value inside an operator. must be a simple projected node value.
        if (isSimple && inOperator) {
          ParserProperty._checkInputValueType(component, inputNodeTypeName, value)
          outputNode = _t(new ProjectedNode({
            name: component.propertyName,
            type: outputNodeTypeName || value.naturalNodeType,
            array: value.isNaturalArray,
            readAccess: acl.AccessLevels.None,
            sourceComponent: component,
            sourceNodes: [] // <-- no known source nodes
          }))
          break
        }

        // inclusions are not allowed in projections
        if (isSimple && !inOperator && component.stage.key === '$group') {
          if (value.underlyingValue !== null) {
            throw Fault.create('cortex.invalidArgument.query', { reason: 'property inclusions and literal values are not allowed here. try wrapping your value in a $literal.', path: value.fullpath })
          }
        }

        let inputFullpath = isSimple ? component.fullpath : value.underlyingValue,
            candidateProperty = _.find(candidateProperties, property => inputFullpath === property.propertyFullpath),
            sourceNodes = (candidateProperty ? candidateProperty.nodes : _.values(candidateModels.reduce((nodes, model) => {
              return model.schema.node.findNodes(inputFullpath, [], { stopAt: (node) => node.getTypeName() === 'Any' }).reduce((nodes, node) => {
                const current = nodes[node.fqpp]
                if (!current || (current.root.typeMasterNode && !node.root.typeMasterNode)) {
                  nodes[node.fqpp] = node.master || node
                }
                return nodes
              }, nodes)
            }, {}))).filter(node => {

              // is the discriminator node in the candidate list? if so, only select nodes which are in the target.
              let discriminatorKey = node.pathParent.discriminatorKey,
                  discriminatorProperty,
                  names
              if (!discriminatorKey || node.name === discriminatorKey) {
                return true
              }
              discriminatorProperty = _.find(candidateProperties, property => node.parent.properties.name.fullpath === property.propertyFullpath)
              if (!discriminatorProperty) {
                return true
              }
              names = discriminatorProperty.nodes.map(n => n.parent.fqpp)
              if (~names.indexOf(node.parent.fqpp)) {
                return true
              }
            }),
            readAccess = acl.AccessLevels.None,
            inputNode

        sourceNodes.forEach(node => {
          let n = node
          while (n && n !== n.root) {
            readAccess = Math.max(readAccess, n.readAccess)
            ParserProperty.authorize(component, n, { bumpParserAccess: component.stage.key === '$group' })
            if (n.groupReader || n.virtual) {
              if (!(n === node && isSimple)) { // allow projections to occur on level nodes.
                throw Fault.create('cortex.invalidArgument.query', { reason: '"' + component.key + '" cannot project on a property not backed by concrete data (' + n.fqpp + ')', path: component.fullpath })
              }
            }
            n = n.parent
          }
        })

        if (sourceNodes.length === 0 && value.parser.strict) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'strict: there are no properties that could match ' + inputFullpath, path: value.fullpath })
        }

        // do NOT allow renaming of non-custom nodes unless in a group.
        // in a group, everything gets disconnected from source anyway, so the danger of projecting dependencies is not present.
        if (component.stage.key !== '$group' && component.stage.key !== '$addFields' && !isSimple && !inOperator) {
          const renamedNodesCount = candidateModels.reduce((count, model) => {
            return model.schema.node.findNodes(component.propertyFullpath, []).reduce((count, node) => {
              return ++count
            }, count)
          }, 0)
          if (renamedNodesCount) {
            throw Fault.create('cortex.invalidArgument.query', { reason: 'Cannot rename built-in fields.', path: component.propertyFullpath })
          }
        }
        inputNode = new ProjectedNode({
          name: component.propertyName,
          type: outputNodeTypeName,
          readAccess: readAccess,
          array: candidateProperty ? candidateProperty.isArray : null, // <-- unwound candidate projection?
          sourceComponent: component,
          sourceNodes: sourceNodes // <-- source nodes

        })
        ParserProperty._checkInputTypeFromSources(component, inputNodeTypeName, inputNode)
        outputNode = _t(inputNode)
        if (customOperator) {
          outputNode = customOperator.customize(outputNode, value.value.at(0))
        }
        // make sure group stage identifier properties are fully child secured. this is because identity information will be lost and all data
        // will be read as a raw value.
        if (component.stage.key === '$group' && !inOperator) { // <-- must be an id!
          outputNode.authorize_for_projection_amalgamation()
          if (outputNode.hasReader) {
            throw Fault.create('cortex.invalidArgument.query', { reason: '"' + component.key + '" cannot select on a property not backed by concrete data (' + outputNode.source_nodes_with_readers.map(n => n.fqpp).join(', ') + '). try matching the property out of projection candidacy.', path: component.fullpath })
          }
        }
        break

      case ParserConsts.Expression: {

        const isPropertyDocument = !expressionOperator

        if (isPropertyDocument) {

          // if any of the children, no matter how deep, are simple projections, we can determine if this
          // property will be an array because we are projecting the original in some form.
          let hasOriginalProjection = false,
              onlyHasOriginalProjections = true,
              readAccess = acl.AccessLevels.None,
              sourceNodes = [],
              candidateProperty = null,
              sourceIsArray = null

          component.walk(true, false, component => {
            const fullpath = component.fullpath
            if (fullpath && !~fullpath.indexOf('$')) {
              if (component.value.type === ParserConsts.Expression) {
                // consider things like $expand natural projections.
                const op = component.value.value.at(0).operator
                if (op && op.isCustomOperator) {
                  hasOriginalProjection = true
                  return -2 // stop processing this branch.
                }
                return // skip past expressions that might be sub objects.
              }
              if (component.value.type === ParserConsts.Simple) {
                if (component.value.underlyingValue) {
                  hasOriginalProjection = true
                  return
                }
              }
            }
            onlyHasOriginalProjections = false
          })

          // we don't need to authorize, since child projections will do so. we do, however need to see
          // if we should be creating a generic document node or a subset of the original.
          // but since we could potentially identifiers from sets of document arrays (because _id is public), we'll authorize anyway.
          if (hasOriginalProjection) {
            candidateProperty = _.find(candidateProperties, property => component.propertyFullpath === property.propertyFullpath)
            sourceNodes = (candidateProperty ? candidateProperty.nodes : _.values(candidateModels.reduce((nodes, model) => {
              return model.schema.node.findNodes(component.propertyFullpath, []).reduce((nodes, node) => {
                const current = nodes[node.fqpp]
                if (!current || (current.root.typeMasterNode && !node.root.typeMasterNode)) {
                  nodes[node.fqpp] = node.master || node
                }
                return nodes
              }, nodes)
            }, {}))).filter(node => {

              // is the discriminator node in the candidate list? if so, only select nodes which are in the target.
              let discriminatorKey = node.pathParent.discriminatorKey,
                  discriminatorProperty,
                  names

              if (!discriminatorKey || node.name === discriminatorKey) {
                return true
              }
              discriminatorProperty = _.find(candidateProperties, property => node.parent.properties.name.fullpath === property.propertyFullpath)
              if (!discriminatorProperty) {
                return true
              }
              names = discriminatorProperty.nodes.map(n => n.parent.fqpp)
              if (~names.indexOf(node.parent.fqpp)) {
                return true
              }
            })

            sourceNodes.forEach(node => {

              if (sourceIsArray == null && sourceIsArray !== -1) {
                sourceIsArray = node.array
              } else if (sourceIsArray !== node.array) {
                sourceIsArray = -1
              }

              let n = node
              while (n && n !== n.root) {
                readAccess = Math.max(readAccess, n.readAccess)
                ParserProperty.authorize(component, n, { bumpParserAccess: component.stage.key === '$group' })
                if (n.groupReader || n.virtual) {
                  if (!(n === node)) { // allow projections to occur on level nodes.
                    throw Fault.create('cortex.invalidArgument.query', { reason: '"' + component.key + '" cannot project on a property not backed by concrete data (' + n.fqpp + ')', path: component.fullpath })
                  }
                }
                n = n.parent
              }
            })
          }

          ParserProperty._checkInputTypeFromName(component, inputNodeTypeName, 'Document')
          outputNode = _t(new ProjectedDocument({
            name: component.propertyName,
            readAccess: acl.AccessLevels.None,
            type: outputNodeTypeName,
            array: candidateProperty ? candidateProperty.isArray : sourceIsArray == null ? false : sourceIsArray, // <-- unwound candidate projection?
            sourceComponent: component,
            sourceNodes: sourceNodes, // <-- source nodes
            properties: value.value.map(value => ParserProperty.generateNode(value.value, candidateModels, candidateProperties)), // <-- will read out as document/set
            naturalProjection: onlyHasOriginalProjections
          }))

        } else {

          // do not allow renaming of existing property fields.
          if (!~component.fullpath.indexOf('$')) {
            if (!((component.propertyFullpath === '_id' && component.stage.key === '$group') || component.stage.key === '$addFields')) {
              const renamedNodesCount = candidateModels.reduce((count, model) => {
                return model.schema.node.findNodes(component.propertyFullpath, []).reduce((count, node) => {
                  return ++count
                }, count)
              }, 0)
              if (renamedNodesCount) {
                throw Fault.create('cortex.invalidArgument.query', { reason: 'Cannot rename existing property fields.', path: component.propertyFullpath })

              }
            }
          }

          const inputNode = expressionOperator.generator(value.value.at(0), candidateModels, candidateProperties, outputNodeTypeName, expectingComponentNodeToBeArray)
          ParserProperty._checkInputTypeFromName(component, inputNodeTypeName, inputNode.getTypeName())
          outputNode = _t(inputNode)
        }
        break
      }

      case ParserConsts.Array: {

        const outputNodes = value.value.map((value, i) => {
          // for now, prevent arrays in arrays. use literal $array for this.
          // if (value.type == ParserConsts.Array) {
          //    throw Fault.create('cortex.unsupportedOperation.unspecified', {reason: 'Pipeline arrays of arrays are unsupported. use a $literal.', path: value.fullpath});
          // }
          const inputNode = ParserProperty.generateNode(value, candidateModels, candidateProperties, outputNodeTypeName, inputNodeTypeName, null, transformer)
          ParserProperty._checkInputTypeFromName(component, inputNodeTypeName, inputNode.getTypeName())
          return inputNode
        })

        // some kind of literal array value. project an array of constituent values.
        outputNode = _t(new ProjectedNode({
          name: component.propertyName,
          type: outputNodeTypeName,
          array: true,
          readAccess: outputNodes.reduce((readAccess, node) => Math.max(readAccess, node.readAccess), acl.AccessLevels.None),
          sourceComponent: component,
          sourceNodes: outputNodes
        }))
        break
      }

      default:
        throw Fault.create('cortex.unsupportedOperation.query', { reason: 'Unknown match value type.', path: this.fullpath })
    }

    ParserProperty._checkOutputType(component, outputNodeTypeName, expectingComponentNodeToBeArray, outputNode)

    // CTXAPI-167 - Get source nodes to know if is a localized property
    component.build_sourceNodes = (component.build_sourceNodes || []).concat(ParserProperty.extractLocalizedSourceNodes(outputNode))
    return outputNode

  }

  static extractLocalizedSourceNodes(outputNode, result = []) {
    if (outputNode.sourceNodes && outputNode.sourceNodes.length) {
      for (let sc of outputNode.sourceNodes) {
        if (sc instanceof ProjectedNode) {
          result = ParserProperty.extractLocalizedSourceNodes(sc, result)
        } else {
          result.push(sc)
        }
      }
    }
    return result
  }

  static _checkInputTypeFromName(component, inputNodeTypeName, sourceTypeName) {
    if (component.parser.strict && inputNodeTypeName != null && !~toArray(inputNodeTypeName, !!inputNodeTypeName).indexOf(sourceTypeName)) {
      throw Fault.create('cortex.invalidArgument.query', {
        reason: '"' + component.key + '" expression expected input to be "' + inputNodeTypeName + '" but got "' + sourceTypeName + '"',
        path: component.fullpath
      })
    }
  }

  static _checkInputValueType(component, inputNodeTypeName, value) {
    ParserProperty._checkInputTypeFromName(component, inputNodeTypeName, value.naturalNodeType)
  }

  static _checkInputTypeFromSources(component, inputNodeTypeName, inputNodes) {
    toArray(inputNodes, !!inputNodes).forEach((inputNode, i) => {
      ParserProperty._checkInputTypeFromName(component, inputNodeTypeName, inputNode.getSourceTypeName())
    })
  }

  static _checkOutputType(component, outputNodeTypeName, expectingComponentNodeToBeArray, outputNode) {
    if (outputNode) {
      if (outputNodeTypeName != null && outputNode.getTypeName() !== outputNodeTypeName) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '"' + component.key + '" expression expected output to be "' + outputNodeTypeName + '" but got "' + outputNode.getTypeName() + '"', path: component.fullpath })
      }

      if (expectingComponentNodeToBeArray != null && outputNode.array !== expectingComponentNodeToBeArray) {
        throw Fault.create('cortex.invalidArgument.query', { reason: '"' + component.key + '" expression is' + (expectingComponentNodeToBeArray ? '' : ' not') + ' expecting an array.', path: component.fullpath })
      }
    }
  }

}

// ---------------------------------------------------------------

Object.assign(ProjectedNodeMixin, {

  __Projected__: true,

  _constructor: function(options) {

    this.readable = true
    this._typeName = options.type
    this.sourceComponent = options.sourceComponent
    this.sourceNodes = toArray(options.sourceNodes, !!options.sourceNodes)

    // reset array
    if (options.array == null) {
      let array = -1
      for (let node of this.sourceNodes) {
        if (array === -1) {
          array = !!node.array
        } else if (array !== node.array) {
          array = -1
          break
        }
      }
      this.array = array
    }

  },

  getTypeName: function() {
    if (!this._typeName) {
      this._typeName = this.getSourceTypeName() || 'Unknown'
    }
    return this._typeName
  },

  getSourceTypeName: function() {
    if (!this._sourceTypeName) {
      let type = null
      for (let node of this.sourceNodes) {
        let t = node.getTypeName()
        if (type == null) {
          type = t
          if (type === 'Unknown') {
            break
          }
        } else if (t !== type || type === 'Document' || type === 'Reference') { // documents and references may have differences, force to unknown.
          type = 'Unknown'
          break
        }
      }
      this._sourceTypeName = type
    }
    return this._sourceTypeName
  },

  getPublicTypeName: function() {
    if (!this._publicTypeName) {
      let type = null
      for (let node of this.sourceNodes) {
        let t = node.getPublicTypeName()
        if (type == null) {
          type = t
          if (type === 'Unknown') {
            break
          }
        } else if (t !== type) { // documents and references may have differences, force to unknown.
          type = 'Unknown'
          break
        }
      }
      this._publicTypeName = type || 'Unknown'
    }
    return this._publicTypeName
  },

  isExpandable: function() {
    if (this.getTypeName() === 'Reference' && this.array === false) {
      return _.all(this.sourceNodes, node => _.isFunction(node.isExpandable) ? node.isExpandable() : (node.getTypeName() === 'Reference' && node.array === false && node.expandable))
    }
    return false
  },

  getNativeSources: function() {
    if (!this._nativeSources) {
      const native = this._nativeSources = []
      this.sourceNodes.forEach(node => {
        if (node.__Projected__) {
          node.getNativeSources().forEach(node => {
            if (!native.includes(node)) {
              native.push(node)
            }
          })
        } else if (!native.includes(node)) {
          native.push(node)
        }
      })
    }
    return this._nativeSources
  },

  /**
     * once authorized, source nodes can be released, because we should no longer know how to read from source.
     */
  authorize_for_projection_amalgamation: function() {

    // update read access and protect children. reason is, this may very well end up being an 'Unknown' property, in which case
    // it will have to be readable as a raw value. (eg. $cmp)
    this._readAccess = this.sourceNodes.reduce((readAccess, node) => {
      node.walk(n => {
        readAccess = Math.max(readAccess, n.readAccess)

        if (!n.readable) {
          throw Fault.create('cortex.notFound.property', { path: this.sourceComponent.fullpath })
        }
        if (n.acl.length && this.sourceNodes.length > 1) {
          throw Fault.create('cortex.unsupportedOperation.query', { reason: 'Property may not be used due to ambiguous access control list combining in projection.', path: this.sourceComponent.fullpath })
        }
        const ac = this.sourceComponent.parser.ac
        if (ac.scoped) {
          this.getNativeSources().forEach(n => {
            if (n.scoped && !ac.inAuthScope(`object.read.${n.fqpparts[0]}.*.${n.fqpparts[1]}`, false)) {
              throw Fault.create('cortex.accessDenied.scope', { reason: `Scoped access denied for ${n.fqpp}`, path: this.sourceComponent.fullpath })
            }
          })
        }
        if (!this.sourceComponent.parser._allowSystemAccess && n.readAccess === acl.AccessLevels.System) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Property may contain hidden or inaccessible values, so cannot be used in the projection. try projecting individual constituent properties.', path: this.sourceComponent.fullpath })
        }
        if (n.getTypeName() === 'Any' && this.sourceComponent.strict) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Any type property ' + n.fqpp + ' cannot be used in this expression.', path: this.sourceComponent.fullpath })
        }
        if (n === node || !n.allowBenignProjectionAndGrouping) {
          if ((n.reader && !n.readerSearchOverride) || n.groupReader || n.virtual) {
            throw Fault.create('cortex.invalidArgument.query', { reason: '"' + this.sourceComponent.key + '" cannot select on a property ' + n.fqpp + ' not backed by concrete data inside of a property amalgamation.', path: this.sourceComponent.fullpath })
          }
        }
        this.sourceComponent.parser._nodeAuthorized(n, this.sourceComponent)
      })
      return readAccess
    }, this._readAccess)
    if (this.sourceComponent.stage.key === '$group') {
      this.sourceComponent.parser.bumpAccessLevel(this._readAccess)
    }

    // if there's a single node, leave the thread so we can operate on it later.
    if (this.sourceNodes.length !== 1) {
      this.getTypeName()
      this._hasReader = false
      this._hasGetters = false
      this._pj_deps = []
      this.sourceNodes = []
    }

  },

  bumpReadAccess: function(readAccess) {
    this._readAccess = Math.max(this._readAccess, acl.fixAllowLevel(readAccess, true))
  }

})

Object.assign(ProjectedNodeProperties, {

  hasReader: {
    get: function() {
      if (this._hasReader == null) {
        let hasReader = false
        for (let node of this.sourceNodes) {
          if ((node.reader && !node.readerSearchOverride) || node.groupReader) {
            hasReader = true
            break
          }
        }
        this._hasReader = hasReader
      }
      return this._hasReader
    }
  },

  source_nodes_with_readers: {
    get: function() {
      return this.sourceNodes.filter(node => (node.reader && !node.readerSearchOverride) || node.groupReader)
    }
  },

  /**
     * null or a singular possible source node.
     */
  single_source_node: {
    get: function() {
      if (this._ssn === undefined) {
        if (this.sourceNodes.length !== 1) {
          this._ssn = null
        } else if (this.sourceNodes[0].__Projected__) {
          return this.sourceNodes[0].single_source_node
        } else {
          const sourceNode = this.sourceNodes[0],
                nodes = {}
          let ok = true,
              baseName = null
          for (let model of this.sourceComponent.parser.models) {
            if (baseName === null) {
              baseName = model.objectName
            } else if (baseName !== model.objectName) {
              ok = false
              break
            }
            model.schema.node.findNodes(sourceNode.fullpath, []).forEach(node => {
              const current = nodes[node.fqpp]
              if (!current || (current.root.typeMasterNode && !node.root.typeMasterNode)) {
                nodes[node.fqpp] = node.master || node
              }
            })
          }
          ok = ok && Object.keys(nodes).length === 1 && nodes[sourceNode.fqpp] === sourceNode
          this._ssn = ok ? sourceNode : null
        }
      }
      return this._ssn
    }
  },

  hasGetters: {
    get: function() {
      if (this._hasGetters == null) {
        let hasGetters = false
        for (let node of this.sourceNodes) {
          if (node.get && node.get.length.length) {
            hasGetters = true
            break
          }
        }
        this._hasGetters = hasGetters
      }
      return this._hasGetters
    }
  },

  dependencies: {
    get: function() {
      if (!this._pj_deps) {
        this._pj_deps = this.sourceNodes.reduce((deps, node) => _.extend(deps, node.dependencies), {})
      }
      return this._pj_deps
    }
  },

  runtimeProcessor: {
    get: function() {
      return this._runtime_processor
    },
    set: function(v) {
      this._runtime_processor = v
    }
  },

  groupReader: {
    get: function() {
      return this.sourceNodes ? this.sourceNodes.find(node => node.groupReader) : null
    },
    set: function(v) {

    }
  },

  virtual: {
    get: function() {
      return this.sourceNodes ? this.sourceNodes.some(node => node.virtual) : false
    },
    set: function(v) {

    }
  }

})

class ProjectedNode extends PropertyDefinition {

  constructor(options) {
    options = options || {}
    super(options)
    this._constructor(options)
  }

  getMongooseType() {
    const primitives = ['Date', 'String', 'Number', 'Boolean', 'ObjectId']
    let type = this.getTypeName()
    if (~primitives.indexOf(type)) {
      return this.array ? [type] : type
    }
    return 'Mixed'
  }

  _readFromSource(ac, parentDocument, selection, sourceNode) {

    if (this.runtimeProcessor && sourceNode instanceof ProjectedNode) {
      sourceNode.runtimeProcessor = this.runtimeProcessor // <-- pass along runtime processsors
    }
    return sourceNode.aclRead(ac, parentDocument, selection)

  }

  findNodes(path, into) {
    if (this.sourceNodes && this.sourceNodes.length) {
      if (this.sourceNodes[0].properties) {
        into.push(this.sourceNodes[0].properties[path])
        return into
      }
      return this.sourceNodes[0].findNodes(path, into)
    }
  }

  aclRead(ac, parentDocument, selection) {

    // the document has been typed with "doc.$source_constructor". attempt to related the data
    // back to the correct source node. if we can find the thread back, then read it out using the
    // source node's reader.

    // in cases where typing information is especially important, like for "any" types, or where
    // leaking child data would be especially detrimental, like a document that might not be secured,
    // having lost child reader information could leak sensitive data.

    // as such, make sure that if there are any source nodes, assume children are unsecured and that
    // we should be able to find the appropriate source node to read the document property.

    if (this.array === false) selection.setTreatAsIndividualProperty()
    selection.pathOverride = this.docpath
    selection.runtimeProcessor = this.runtimeProcessor

    // limit the source nodes to type and object.
    const rootDoc = ac.document,
          sourceRootNode = rootDoc.sourceConstructorNode()

    if (this.single_source_node) {

      return this._readFromSource(ac, parentDocument, selection, this.single_source_node)

    } else {

      // narrow down relevant source nodes to help with ambiguity later on.
      const relevantSourceNodes = !sourceRootNode ? this.sourceNodes : this.sourceNodes.filter(node => {
              const root = node.root
              if (root.objectName === sourceRootNode.objectName) {
                return !isSet(root.objectTypeName) || root.objectTypeName === sourceRootNode.objectTypeName
              }
            }),
            rawValue = parentDocument.getValue ? parentDocument.getValue(this.docpath) : pathTo(parentDocument, this.docpath),
            rawValueType = modules.db.definitions.typeSimpleValue(rawValue),
            isRawValuePrimitive = ~PRIMITIVES.indexOf(rawValueType)

      // if the value is an any type, convert and read out.
      if (rawValueType === 'Any') {
        return AnyDefinition.readAny(rawValue)
      }

      // if this is primitive value with no readers, we can safely return the plain value.
      if (isRawValuePrimitive && !this.hasGetters && !this.hasReader) {
        if (!this.hasReadAccess(ac)) {
          if ((ac.passive || selection.passive) && ac.propPath !== this.fullpath) {
            return undefined
          }
          throw Fault.create('cortex.accessDenied.propertyRead', { path: this.fullpath })
        }
        return rawValue
      }

      // if there are no source nodes, read as getter or value. anything without a source node would have had its children protected (account for stray 'any' types).
      if (relevantSourceNodes.length === 0) {
        if (!this.hasReadAccess(ac)) {
          if ((ac.passive || selection.passive) && ac.propPath !== this.fullpath) {
            return undefined
          }
          throw Fault.create('cortex.accessDenied.propertyRead', { path: this.fullpath })
        }
        return rawValue
      }

      // if there is a single source_node, read using the source node.
      if (relevantSourceNodes.length === 1) {
        return this._readFromSource(ac, parentDocument, selection, relevantSourceNodes[0])
      }

      // attempt to read as variable set nodes.
      // (null means none were from set nodes, false means some but did not all match)
      let setNode = relevantSourceNodes.reduce((setNode, sourceNode) => {
        if (setNode !== false) {
          if (sourceNode.pathParent.getTypeName() === 'Set') {
            if (setNode === null) {
              setNode = sourceNode.pathParent
            } else if (sourceNode.pathParent !== setNode) {
              setNode = false
            }
          } else if (setNode !== undefined) {
            setNode = false
          }
        }
        return setNode
      }, null)

      // we've found a number of values from a set. all we have to do is find the correct document vis discriminator.
      if (setNode) {
        const discriminatorValuePath = setNode.fullpath + '.' + setNode.discriminatorKey,
              discriminatorValue = rootDoc.get(discriminatorValuePath),
              documentNode = setNode.documents[discriminatorValue],
              documentPropertyNode = pathTo(documentNode, 'properties.' + relevantSourceNodes[0].name)
        if (documentPropertyNode) {
          return this._readFromSource(ac, parentDocument, selection, documentPropertyNode)
        }
      }

      throw Fault.create('cortex.invalidArgument.query', { reason: 'A document property has been read ambiguously and the type information has been lost. as such, the value cannot be safely read. try adjust your query to ensure type information is available.', path: this.fullpath })

    }

  }

}

_.extend(ProjectedNode.prototype, ProjectedNodeMixin)
Object.defineProperties(ProjectedNode.prototype, ProjectedNodeProperties)

class ProjectedDocument extends DocumentDefinition {

  constructor(options) {
    super(options)
    this._constructor(options)
    this.naturalProjection = options.naturalProjection // hint that all children are naturally projected. (no custom fields).
  }

  aclRead(ac, parentDocument, selection) {

    if (this.array === false) {
      selection.setTreatAsIndividualProperty()
    }

    if (!this.naturalProjection) {
      return super.aclRead(ac, parentDocument, selection)
    }

    // attempt to use the document's natural reader with projected selections.
    // first we have to match against relevant nodes because we could have multiple object/typing candidates.
    const rootDoc = ac.document,
          sourceRootNode = rootDoc.sourceConstructorNode(),
          // narrow down relevant source nodes to help with ambiguity later on.
          relevantSourceNodes = !sourceRootNode ? this.sourceNodes : this.sourceNodes.filter(node => {
            const root = node.root
            if (root.objectName === sourceRootNode.objectName) {
              return !isSet(root.objectTypeName) || root.objectTypeName === sourceRootNode.objectTypeName
            }
          }),
          rawValue = parentDocument.getValue ? parentDocument.getValue(this.name) : pathTo(parentDocument, this.name)

    // if there are no source nodes, read as getter or value. anything without a source node would have had its children protected (account for stray 'any' types).
    if (relevantSourceNodes.length === 0) {
      return rawValue
    }

    // if there is a single source_node, read using the source node.
    if (relevantSourceNodes.length === 1) {

      const sourceRoot = relevantSourceNodes[0].root

      // ensure selections have any runtime processors that might be attached.
      this.walk((projectedNode) => {
        if (projectedNode.runtimeProcessor) {
          const matchNode = sourceRoot.findNode(projectedNode.fullpath)
          if (matchNode) {
            const sel = selection.findSelection(pathParts(projectedNode.fullpath)[1])
            if (sel) {
              sel.runtimeProcessor = projectedNode.runtimeProcessor
            } else {
              // failed to find processor. fail silently :(
            }
          }
        }
      })
      return relevantSourceNodes[0].aclRead(ac, parentDocument, selection)
    }

    throw Fault.create('cortex.invalidArgument.query', { reason: 'A document has been read ambiguously and the type information has been lost. as such, the value cannot be safely read. try adjust your query to ensure type information is available.', path: this.fullpath })

  }

  findNodes(...args) {
    return super.findNodes(...args)
  }

}
_.extend(ProjectedDocument.prototype, ProjectedNodeMixin)
Object.defineProperties(ProjectedDocument.prototype, ProjectedNodeProperties)

module.exports = ParserProperty
