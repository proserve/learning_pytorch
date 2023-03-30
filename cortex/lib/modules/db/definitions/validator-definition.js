'use strict'

const util = require('util'),
      DocumentDefinition = require('./types/document-definition'),
      modules = require('../../../modules'),
      transpiler = modules.services.transpiler,
      { deserializeObject, array: toArray, extend } = require('../../../utils'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault')

/**
 * @constructor
 */
function ValidatorDefinition(options) {

  var properties = [{
    label: '_id',
    name: '_id',
    type: 'ObjectId',
    // description: 'The validator identifier',
    readable: true,
    auto: true
  }, {
    label: 'Name',
    name: 'name',
    type: 'String',
    // description: 'The name of an available validator.',
    readable: true,
    writable: true,
    dependencies: ['.definition', '..type', '..array'],
    writer: function(ac, node, value) {
      this.markModified('definition')
      return value
    },
    validators: [{
      name: 'stringEnum',
      definition: {
        values: modules.validation.exposed
      }
    }, {
      name: 'adhoc',
      definition: {
        validator: function(ac, node, value) {
          return modules.validation.okForType(value, this.parent().type, this.parent().array)
        }
      }
    }]
  }, {
    // validator code for uniqueness and merging
    label: 'Code',
    name: 'code',
    type: 'String',
    dependencies: ['._id'],
    writable: true,
    trim: true,
    writer: function(ac, node, value) {
      return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(value))
    },
    validators: [{
      name: 'customName'
    }, {
      name: 'uniqueInArray'
    }]
  }, {
    label: 'Description',
    name: 'description',
    type: 'String',
    // description: 'A short description of the property validator.',
    readable: true,
    writable: true,
    validators: [{
      name: 'printableString',
      definition: {
        min: 0,
        max: 256
      }
    }]
  }, {
    label: 'Definition',
    name: 'definition',
    type: 'Any',
    // description: 'Validator options.',
    dependencies: ['.name'],
    readable: true,
    writable: true,
    transform: function(ac, node, selection, value) {
      if (this.name === 'script') {
        return {
          script: (value && value.script) || ''
        }
      }
      return value
    },
    validators: [{
      name: 'adhoc',
      definition: {
        message: 'Valid validation options',
        validator: function(ac, node, value, callback) {
          const validator = modules.validation.validators[this.name]
          if (!validator || (_.isFunction(validator.expose) && !validator.expose(ac, node, value)) || !validator.expose) {
            return callback(null, false)
          }

          // @todo @hack special case for script validator. we don't have async json validation. switch to ajv or get rid of json schema altogether.
          if (this.name === 'script') {

            value = (value ? deserializeObject(value._dat_) : {})
            const source = value.script,
                  transpileOptions = {
                    filename: `Validate ${this.parent().name}`,
                    language: 'javascript',
                    specification: 'es6'
                  }
            return transpiler.transpile(source, transpileOptions, (err, result) => {
              if (!err) {
                this.definition = {
                  script: source,
                  requires: toArray(result.imports),
                  compiled: result.source
                }
              }
              callback(err, true)
            })
          }

          if (validator.jsonSchema) {
            try {
              validator.validateOptions(this.schema, value ? deserializeObject(value._dat_) : {})
            } catch (err) {
              return callback(err)
            }
          } else if (value !== undefined) {
            return callback(Fault.create('cortex.invalidArgument.missingValidatorDefinition'))
          }
          callback(null, true)
        }
      }
    }]
  }]

  DocumentDefinition.call(this, extend({}, options, { properties: properties }))
}
util.inherits(ValidatorDefinition, DocumentDefinition)

module.exports = ValidatorDefinition
