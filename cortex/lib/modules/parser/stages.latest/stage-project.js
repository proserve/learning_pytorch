/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('../parser-consts'),
      ParserStage = require('./stage'),
      ParserProperty = require('../property'),
      PipelineExpression = require('../pipeline-expression'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        ParserModel: `${__dirname}/../model`
      })

/**
 * the projection stage does not do any complicated transformations; the output projection is the same as the input projection.
 *
 * if we tried to support things like
 *
 *  gt: ['$c_set.c_value', 2]
 *
 *  gt: {$or: [
 *           {$and: [{$eq: ['$c_set.name', {$literal: 'c_a'}]}, {$gte: ['$c_set.c_value', '2']}]},
 *           {$and: [{$eq: ['$c_set.name', {$literal: 'c_b'}]}, {$gte: ['$c_set.c_value', 2]}]}
 *   ]},
 *
 *  we would not get far if the second element was a generated projection, like ['$c_set.c_value', {$cond: ['$c_value', '$c_a', '$c_b']}].
 *
 *  this is further complicated when the element is a document array, necessitating the use of a $filter replacement.
 *
 *  instead, we simply allow mongodb to compare and project using it's own comparison order, and project each property with a set of possible
 *  nodes that ignore type where possible but enforce readAccess at the highest level, with some other restriction.
 *
 *  so here, all properties are generated from top-down.
 */

class ProjectStage extends ParserStage {

  static get type() { return '$project' }

  static get indexable() { return false }

  normalize(expression) {
    if (_.isString(expression) && expression.match(/^[0-9a-z_]+$/i)) {
      expression = { _id: expression }
    }
    return super.normalize(expression)

  }

  parseOperator(key, value) {
    return new ProjectRootExpression(this, value)
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

  _build() {

    const project = utils.flattenProjection(this.value.build())

    if (!this.isRaw) {

      // include property dependencies.
      this.models[0].schema.node.walk(n => {
        if (n.dependencies) {
          _.map(n.dependencies || {}, (val, dep) => {
            const existing = utils.path(project, dep)
            if (utils.isSet(existing) && !!existing !== val) {
              throw Fault.create('cortex.invalidArgument.query', { reason: 'A required dependency has been excluded or renamed.', path: dep })
            }
            try {
              // utils.path(project, dep, val);
              project[dep] = val
            } catch (err) {
              // higher level already set. eg, {c_set: 1} and we want to include 'c_set.name' : 1
            }
          })
        }
      })

      // include required acl paths.
      this.models[0].requiredAclPaths.forEach(dep => {
        const existing = utils.path(project, dep)
        if (utils.isSet(existing) && !!existing !== true) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'A required dependency has been excluded or renamed.', path: dep })
        }
        utils.path(project, dep, 1)
      })
      utils.optimizePathSelections(project)
    }

    return {
      $project: project
    }
  }

  get models() {
    if (this.isRaw) {
      return this.isFirst ? this.parser.models : this.prev.models
    }
    if (!this._models) {
      return []
    }
    return this._models
  }

  get properties() {
    if (this.isRaw) {
      return this.isFirst ? [] : this.prev.properties
    }
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

    if (!this.isRaw) {
      /*
            // include required properties from original as non-readable nodes (to ensure they are included in the schema);
            model.getAutomaticallyIncludedSelections = function() {
                if (!this._autoInclude) {
                    this._autoInclude = utils.optimizePathSelections(candidateModels.reduce((all_deps, model) => {
                        model.schema.node.walk(n => {
                            if (n.dependencies) {
                                _.map(n.dependencies||{}, (val, dep) => {
                                    const existing = utils.path(all_deps, dep);
                                    if (existing != null && existing != val) {
                                        throw Fault.create('cortex.invalidArgument.query', {reason: 'A required dependency has been excluded or renamed.', path: dep});
                                    }
                                    try {
                                        all_deps[dep] = 1;
                                    } catch(err) {
                                        // higher level already set. eg, {c_set: 1} and we want to include 'c_set.name' : 1
                                    }
                                });
                            }
                        });
                        model.requiredAclPaths.forEach(dep => {
                            const existing = utils.path(all_deps, dep);
                            if (existing != null && existing != 1) {
                                throw Fault.create('cortex.invalidArgument.query', {reason: 'A required dependency has been excluded or renamed.', path: dep});
                            }
                            utils.path(all_deps, dep, 1);
                        });
                        return all_deps;
                    }, {}));
                }
                return this._autoInclude;
            };
            */

      this._models = [lazy.ParserModel.create(this, properties)]
    }

  }

}

ParserStage.register(ProjectStage)

// ---------------------------------------------------------------------------------------------------------------------

class ProjectRootExpression extends PipelineExpression {

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

    if (!this.value.filter(c => c.key === '_id')[0]) {
      const idComponent = new this.constructor.ComponentClass(this)
      idComponent.parse('_id', 1)
      this.value.push(idComponent)
    }

  }

  get stage() {
    return this.parentComponent
  }

}

module.exports = ProjectStage
