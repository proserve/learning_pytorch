'use strict'

const {
        path: pathTo, array: toArray, isId, rBool, isIdFormat, option: getOption, rString,
        isInt, isInteger, is_ipv4: isIPV4, is_cidr: isCIDR, rInt, equalIds, getValidDate, getIdOrNull,
        testPasswordStrength, isCustomName, profile, normalizeObjectPath
      } = require('../utils'),
      util = require('util'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      moment = require('moment-timezone'),
      modules = require('../modules'),
      { db, phone } = modules,
      { definitions } = db,
      Jjv = require('jjv'),
      acl = require('../acl'),
      phoneUtil = phone.PhoneNumberUtil.getInstance(),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      validUrl = require('valid-url'),
      AsyncFunction = Object.getPrototypeOf(async function() {}).constructor,
      Matchers = {
        email: /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/, // eslint-disable-line no-useless-escape
        emailDomain: /^(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/ // eslint-disable-line no-useless-escape
      },
      json = (() => {

        const v4Schema = {
                'id': 'http://json-schema.org/draft-04/schema#',
                '$schema': 'http://json-schema.org/draft-04/schema#',
                'description': 'Core schema meta-schema',
                'definitions': {
                  'schemaArray': {
                    'type': 'array',
                    'minItems': 1,
                    'items': { '$ref': '#' }
                  },
                  'positiveInteger': {
                    'type': 'integer',
                    'minimum': 0
                  },
                  'positiveIntegerDefault0': {
                    'allOf': [ { '$ref': '#/definitions/positiveInteger' }, { 'default': 0 } ]
                  },
                  'simpleTypes': {
                    'enum': [ 'array', 'boolean', 'integer', 'null', 'number', 'object', 'string' ]
                  },
                  'stringArray': {
                    'type': 'array',
                    'items': { 'type': 'string' },
                    'minItems': 1,
                    'uniqueItems': true
                  }
                },
                'type': 'object',
                'properties': {
                  'id': {
                    'type': 'string',
                    'format': 'uri'
                  },
                  '$schema': {
                    'type': 'string',
                    'format': 'uri'
                  },
                  'title': {
                    'type': 'string'
                  },
                  'description': {
                    'type': 'string'
                  },
                  'default': {},
                  'multipleOf': {
                    'type': 'number',
                    'minimum': 0,
                    'exclusiveMinimum': true
                  },
                  'maximum': {
                    'type': 'number'
                  },
                  'exclusiveMaximum': {
                    'type': 'boolean',
                    'default': false
                  },
                  'minimum': {
                    'type': 'number'
                  },
                  'exclusiveMinimum': {
                    'type': 'boolean',
                    'default': false
                  },
                  'maxLength': { '$ref': '#/definitions/positiveInteger' },
                  'minLength': { '$ref': '#/definitions/positiveIntegerDefault0' },
                  'pattern': {
                    'type': 'string',
                    'format': 'regex'
                  },
                  'additionalItems': {
                    'anyOf': [
                      { 'type': 'boolean' },
                      { '$ref': '#' }
                    ],
                    'default': {}
                  },
                  'items': {
                    'anyOf': [
                      { '$ref': '#' },
                      { '$ref': '#/definitions/schemaArray' }
                    ],
                    'default': {}
                  },
                  'maxItems': { '$ref': '#/definitions/positiveInteger' },
                  'minItems': { '$ref': '#/definitions/positiveIntegerDefault0' },
                  'uniqueItems': {
                    'type': 'boolean',
                    'default': false
                  },
                  'maxProperties': { '$ref': '#/definitions/positiveInteger' },
                  'minProperties': { '$ref': '#/definitions/positiveIntegerDefault0' },
                  'required': { '$ref': '#/definitions/stringArray' },
                  'additionalProperties': {
                    'anyOf': [
                      { 'type': 'boolean' },
                      { '$ref': '#' }
                    ],
                    'default': {}
                  },
                  'definitions': {
                    'type': 'object',
                    'additionalProperties': { '$ref': '#' },
                    'default': {}
                  },
                  'properties': {
                    'type': 'object',
                    'additionalProperties': { '$ref': '#' },
                    'default': {}
                  },
                  'patternProperties': {
                    'type': 'object',
                    'additionalProperties': { '$ref': '#' },
                    'default': {}
                  },
                  'dependencies': {
                    'type': 'object',
                    'additionalProperties': {
                      'anyOf': [
                        { '$ref': '#' },
                        { '$ref': '#/definitions/stringArray' }
                      ]
                    }
                  },
                  'enum': {
                    'type': 'array',
                    'minItems': 1,
                    'uniqueItems': true
                  },
                  'type': {
                    'anyOf': [
                      { '$ref': '#/definitions/simpleTypes' },
                      {
                        'type': 'array',
                        'items': { '$ref': '#/definitions/simpleTypes' },
                        'minItems': 1,
                        'uniqueItems': true
                      }
                    ]
                  },
                  'allOf': { '$ref': '#/definitions/schemaArray' },
                  'anyOf': { '$ref': '#/definitions/schemaArray' },
                  'oneOf': { '$ref': '#/definitions/schemaArray' },
                  'not': { '$ref': '#' }
                },
                'dependencies': {
                  'exclusiveMaximum': [ 'maximum' ],
                  'exclusiveMinimum': [ 'minimum' ]
                },
                'default': {}
              },
              // @todo import the org's schema references?
              // @todo implement jjv options (checkRequired, useDefault, useCoerce, removeAdditional)
              env = new Jjv(),
              isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/ // eslint-disable-line no-useless-escape

        // NOTE: jjv does not allow remote references, so we are safe from remote references. however, each org could possibly maintain it's own schema definitions, in which case
        // we have to maintain env for each org or have a way of adding and removing definitions as needed.
        env.addSchema('http://json-schema.org/draft-04/schema#', v4Schema)

        // for local validation
        env.addType('function', function(fn) {
          return _.isFunction(fn)
        })
        v4Schema.definitions.simpleTypes.enum.push('function')

        // for schema schema validators
        env.addType('schema', function(schema) {
          return validate(v4Schema, schema)
        })
        v4Schema.definitions.simpleTypes.enum.push('schema')

        env.addType('regex', function(pattern) {
          let match
          return _.isString(pattern) && pattern.length > 0 && (match = pattern.match(/^\/(.*)\/(.*)/)) && match[0].length > 0
        })
        v4Schema.definitions.simpleTypes.enum.push('regex')

        env.addType('date', function(date) {
          return (_.isDate(date) && !isNaN(date.getTime())) || (_.isString(date) && isoRegex.test(date))
        })
        v4Schema.definitions.simpleTypes.enum.push('date')

        env.addType('objectId', function(id) {
          return isId(id) || isIdFormat(id)
        })
        v4Schema.definitions.simpleTypes.enum.push('objectId')

        // @todo improve error reporting for json elements.
        // @todo add async (child process?) worker for validation so we don't hang the event loop. same for @see Any type

        function validate(schema, json, callback) {

          let fault, errors, exception
          try {
            errors = env.validate(schema, json)
          } catch (e) {
            exception = e
          }

          if (errors) {
            fault = Fault.create('cortex.invalidArgument.JSONSchemaValidation', { reason: 'JSON schema validation failed.' })
            fault.add(Fault.create('cortex.invalidArgument.invalidJSON', { reason: JSON.stringify(errors) }))
          } else if (exception) {
            fault = Fault.create('cortex.invalidArgument.JSONSchemaValidation', { reason: 'JSON schema validation exception.' })
            fault.add(Fault.from(exception))
          }
          if (arguments.length < 3) {
            if (fault) throw fault
            return true
          } else {
            setImmediate(callback, fault, !fault)
          }

        }

        function validateSchema(...args) {

          validate(v4Schema, ...args)
        }

        return {
          validate,
          validateSchema
        }

      })()

let Undefined,
    validation
// --------------------------------------------------------------------------------------

Fault.addConverter(function mongooseErrorConverter(err) {
  const MongooseError = db.mongoose.Error
  let fault
  if (err instanceof MongooseError.ValidationError) {
    const valErr = err
    err = Fault.create('cortex.invalidArgument.validation')
    for (let name in valErr.errors) {
      if (valErr.errors.hasOwnProperty(name)) {
        fault = valErr.errors[name]
        if (Fault.isFault(fault)) {
          err.add(fault)
        } else {
          const errCode = fault.type || 'cortex.error.unspecified'
          if (errCode) {
            const validator = _.find(validation.validators, (function(errCode) {
              return function(v) {
                return v.errCode === errCode
              }
            }(errCode)))
            fault = Fault.create(errCode, validator ? null : valErr.errors[name].message, 400, name)
            fault.name = name
            err.add(fault)
          }
        }
      }
    }
  } else if (err instanceof MongooseError.CastError) {
    err = Fault.validationError('cortex.invalidArgument.castError', { reason: 'Type conversion failure to expected property type.', path: err.path })
  } else if (err instanceof MongooseError.VersionError) {
    err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error (mv)' })
  }

  return err
})

// --------------------------------------------------------------------------------------

function Validator(type, errCode, message, options) {
  this.errCode = errCode
  this.message = message
  this.skip = _.isFunction(getOption(options, 'skip')) ? options.skip : false
  this.when = _.isFunction(getOption(options, 'when')) ? options.when : false
  this.fn = this.construct(type, options)
  this.isAsyncFn = this.fn instanceof AsyncFunction
  this.schemaType = type
}

Validator.prototype.validate = function(ac, document, value, callback) {

  // if there's an error thrown, propagate but without double callback.
  let self = this,
      node = this.schemaType.node

  try {

    if (this.skip && this.skip.call(document, ac, node, value)) {
      done(null, true)
      return
    }
    if (this.when && !this.when.call(document, ac, node, value)) {
      done(null, true)
      return
    }

    if (this.isAsyncFn) {
      this.fn.call(document, ac, node, value)
        .then(result => {
          done(null, result)
        })
        .catch(done)
    } else {
      if (this.fn.length > 3) {
        this.fn.call(document, ac, node, value, done)
      } else {
        done(null, this.fn.call(document, ac, node, value))
      }
    }

  } catch (err) {
    done(err, false)
  }

  function done(err, ok) {
    if (self) {
      if (arguments.length === 0) {
        // just a callback() assume ok.
        ok = true
      } else if (arguments.length === 1) {
        // single callback value (true/false) or null or an error
        if (err === null || err === undefined) {
          ok = true
        } else if (_.isBoolean(err)) {
          ok = err
          err = null
        }
      }

      if (!ok) {
        err = Fault.from(err)
        if (!err) {
          err = Fault.create(self.errCode || 'cortex.invalidArgument.unspecified', { reason: self.message || '' })
        }
      }
      self = null
      if (err) {
        if (!err.path) {
          err.path = node.fqpp || node.fullpath
        }
        err.resource = ac.getResource()
      }
      callback(err)
    }
  }
}

Validator.prototype.construct = function() {
  return function() {
    return false
  }
}

// -------------------------------------------------

function AdHocValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(AdHocValidator, Validator)

AdHocValidator.prototype.construct = function(type, options) {
  this.errCode = getOption(options, 'errCode', getOption(options, 'code', this.errCode))
  this.message = getOption(options, 'message', this.message)
  this.asArray = getOption(options, 'asArray')
  this.post = !!getOption(options, 'post', false) // for document arrays only! validates the documents after properties.

  let validator = getOption(options, 'validator'),
      construct = getOption(options, 'construct')

  if (!_.isFunction(validator)) {
    validator = function() {
      return false
    }
  }
  if (_.isFunction(construct)) {
    construct.call(this, type, options)
  }
  return validator
}

// -------------------------------------------------

function WriteOnceValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(WriteOnceValidator, Validator)

WriteOnceValidator.prototype.construct = function(type) {

  const isArray = _.isArray(type.options.type),
        node = type.options.propertyNode,
        // -> insert on value added to check for previous value. type.options.propertyNode._onValueAdded
        onValueAdded = function(ac, node, value, previous) {
          if (this.isModified(node.docpath)) {
            if (!this.$__writeOnceOriginalValues) {
              this.$__writeOnceOriginalValues = {}
            }
            if (this.$__writeOnceOriginalValues[node.docpath] === Undefined) {
              this.$__writeOnceOriginalValues[node.docpath] = { value: previous }
            }
          }

        }

  if (isArray) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'writeOnce validator is not compatible with array properties.' })
  }

  if (node._onValueAdded) {
    let _onValueAdded = node._onValueAdded
    node._onValueAdded = function(ac, node, value, previous, index) {
      _onValueAdded.call(this, ac, node, value, previous, index)
      onValueAdded.call(this, ac, node, value, previous, index)
    }

  } else {
    node._onValueAdded = onValueAdded
  }

  return function(ac, node, value) {
    if (this.isNew) {
      return true
    }
    const original = this.$__writeOnceOriginalValues && this.$__writeOnceOriginalValues[node.docpath]
    if (!original) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid state. Could not rewrite property value.' })
    }
    if (original.value !== Undefined) {
      throw Fault.create('cortex.accessDenied.writeOnce', { reason: 'Property cannot be overwritten.' })
    }
    return true
  }
}

// -------------------------------------------------

function DotPathValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(DotPathValidator, Validator)

DotPathValidator.prototype.construct = function(type, options) {

  this.asArray = false

  const { min, max, allowNull = false } = options || {}

  return function(ac, node, value) {
    if (allowNull && !value) {
      return true
    }
    return DotPathValidator.isDotPath(value, { min, max })
  }

}

DotPathValidator.isDotPath = function(value, options) {

  options = options || {}

  const max = rInt(options.max, 1024),
        min = Math.min(rInt(options.min, 1), max)

  return typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[a-zA-Z0-9-_.]+$/.test(value) &&
      normalizeObjectPath(value) === value
}

// -------------------------------------------------

function CustomNameValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(CustomNameValidator, Validator)

/**
 *
 * @param type
 * @param options
 *    prefix: 'c_'
 *    requirePrefix
 * @returns {Function}
 *
 */
CustomNameValidator.prototype.construct = function(type, options) {

  this.asArray = false

  const max = rInt(pathTo(options, 'max'), 40),
        min = Math.min(rInt(pathTo(options, 'min'), 1), max),
        prefix = rString(pathTo(options, 'prefix'), 'c_'),
        allowNs = rBool(pathTo(options, 'allowNs'), true),
        pattern = new RegExp(`^[a-zA-Z0-9-_]{${min},${max}}$`),
        validator = _.isFunction(pathTo(options, 'validator')) ? options.validator : null

  if (!/^[co]_$/.test(prefix)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: `${prefix} is not a valid object prefix` })
  }

  return function(ac, node, value) {

    if (!_.isString(value) || !pattern.test(value)) {
      return false
    }

    const numNsSeps = toArray(value.match(/__/g)).length,
          isLocal = value.indexOf(prefix) === 0,
          isNamespaced = numNsSeps === 1,
          isCustom = isLocal || (isNamespaced && allowNs)

    if (numNsSeps > 1) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: `${value} cannot contain more than 1 namespace separator` })
    }

    if (isNamespaced) { // could still have a c_

      const nsSepPos = value.indexOf('__'),
            namePart = value.substring(nsSepPos + 2)

      if (nsSepPos === 0) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: `${value} is missing a value before the namespace separator (__)` })
      }
      if (namePart.length === 0) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: `${value} is missing a value after the namespace separator (__)` })
      }
    }

    if (validator) {
      return validator(ac, node, value, isCustom, isLocal, isNamespaced)
    }

    return isCustom

  }

}

CustomNameValidator.formatter = function(ns, v, trim = true, lowercase = false, filter = null, defaultPrefix = 'c_') {

  if (!_.isString(v)) {
    if (v === null || v === undefined) {
      return v
    }
    if (v.toString && v.toString !== Object.prototype.toString) { // avoid [object Object]
      v = v.toString()
    } else {
      return v
    }
  }
  if (trim) {
    v = v.trim()
  }
  if (lowercase) {
    v = v.toLowerCase()
  }
  if (v.length > 0) {
    if (!isCustomName(v) && (!filter || !filter(v))) {
      v = defaultPrefix + v
    }
  }

  return v

}

// -------------------------------------------------

function LocaleValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(LocaleValidator, Validator)

LocaleValidator.prototype.construct = function(type, options) {

  this.asArray = false

  let allowNull = getOption(options, 'allowNull', false),
      allowBlank = getOption(options, 'allowBlank', false),
      allowStar = getOption(options, 'allowStar', false),
      locales = toArray((options, 'locales')).map(str => {
        const loc = modules.locale.create(str).serialize()
        if (!loc || loc !== str) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Invalid locale ${str}`, path: type.path })
        }
        return str
      })

  return function(ac, node, value) {

    if ((allowNull && !value) || (allowBlank && value === '') || (allowStar && value === ['*'])) {
      return true
    }

    return modules.locale.isValid(value) && (locales.length === 0 || locales.includes(value))

  }
}

// -------------------------------------------------

function AuthScopeValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(AuthScopeValidator, Validator)

AuthScopeValidator.prototype.construct = function(type, options) {
  this.asArray = false
  return function(ac, node, value) {
    modules.authentication.validateAuthScope(ac.org, value)
    return true
  }
}

// -------------------------------------------------

function UniqueInArrayValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(UniqueInArrayValidator, Validator)

UniqueInArrayValidator.prototype.construct = function(type, options) {

  this.asArray = false

  let isArray = _.isArray(type.options.type),
      valueType = isArray ? type.options.type[0] : type.options.type,
      node = type.options.propertyNode,
      isObjectId = valueType === db.mongoose.Schema.Types.ObjectId,
      isBuffer = valueType === 'Buffer',
      isReference = node && node.parent && node.parent.getTypeName() === 'Reference',
      path = type.path

  node.addDependency('._id', true)

  return function(ac, node, value) {
    let _id = this._id, arr = this.__parentArray, len = (arr ? arr.length : 0), doc
    while (len--) {
      doc = arr[len]
      if (doc && !equalIds(_id, doc._id)) {
        if (isObjectId) {
          if (equalIds(pathTo(doc, path), value)) {
            return false
          }
        } else if (isReference) {
          if (equalIds(pathTo(doc, path), value)) {
            return false
          }
        } else if (isBuffer) {
          const other = pathTo(doc, path)
          if (Buffer.isBuffer(other) && Buffer.isBuffer(value) && value.equals(other)) {
            return false
          }
        } else if (pathTo(doc, path) === value) {
          return false
        }
      }
    }
    return true
  }
}

// -------------------------------------------------

function TimeZoneValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(TimeZoneValidator, Validator)
TimeZoneValidator.prototype.construct = function(type, options) {
  this.asArray = false
  return function(ac, node, value) {
    const zone = moment.tz.zone(value)
    return !!zone && zone.name === value
  }
}

// -------------------------------------------------

function NpiValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(NpiValidator, Validator)

NpiValidator.prototype.construct = function() {
  return NpiValidator.validateNpi
}

/**
 * npi validation using the Luhn algorithm
 *
 * @param ac
 * @param node
 * @param npi a 10/15-digit numeric string
 */
NpiValidator.validateNpi = function(ac, node, npi) {

  if (!_.isString(npi)) {
    return false
  }

  let tmp, sum, i, j = 0
  i = npi.length
  if ((i === 15) && (npi.substring(0, 5) === '80840')) {
    sum = 0
  } else if (i === 10) {
    sum = 24
  } else {
    return false
  }
  while (i--) {
    if (isNaN(npi.charAt(i))) { return false }
    tmp = npi.charAt(i) - '0'
    if (j++ & 1) {
      if ((tmp <<= 1) > 9) {
        tmp -= 10
        tmp++
      }
    }
    sum += tmp
  }

  /* If the checksum mod 10 is zero then the NPI is valid */
  return !(sum % 10)
}

// -------------------------------------------------

function FingerprintValidator(type, code, message, options) {
  Validator.call(this, type, code, message, options)
}
util.inherits(FingerprintValidator, Validator)

FingerprintValidator.prototype.construct = function() {
  return function(ac, node, value) {
    modules.authentication.isFingerprint(value)
  }
}

// -------------------------------------------------

function PhoneNumberValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(PhoneNumberValidator, Validator)

PhoneNumberValidator.MobileTypes = [phone.PhoneNumberType.MOBILE, phone.PhoneNumberType.FIXED_LINE_OR_MOBILE]

PhoneNumberValidator.isShortCode = function(value) {
  value = String(value)
  return isInteger(value) && (value.length === 5 || value.length === 6)
}

PhoneNumberValidator.prototype.construct = function(type, options) {

  const allowNull = !!getOption(options, 'allowNull', false),
        requireMobile = !!getOption(options, 'requireMobile', false),
        allowShortCode = !!getOption(options, 'allowShortCode', false),
        allowedCountries = getOption(options, 'allowedCountries'),
        autoFormat = rBool(getOption(options, 'autoFormat'), true),
        node = type.options.propertyNode

  // store as E.164
  if (autoFormat) {
    node.set.push(function(v) {
      if (allowShortCode && PhoneNumberValidator.isShortCode(v)) {
        return v
      }
      if (_.isString(v)) {
        v = phone.cleanPhone(v)
        if (v[0] !== '+') v = '+' + v
      }
      return v
    })
  }

  return function(ac, node, value) {

    if (allowNull && value == null) {
      return true
    }
    if (_.isString(value)) {
      try {
        if (allowShortCode && PhoneNumberValidator.isShortCode(value)) {
          return true
        }
        let parsed = phoneUtil.parse(value)
        if (phoneUtil.isPossibleNumber(parsed)) {
          if (phone.isValidNumber(value)) {
            if (!requireMobile || ~PhoneNumberValidator.MobileTypes.indexOf(phoneUtil.getNumberType(parsed))) {
              if (!_.isArray(allowedCountries) || ~allowedCountries.indexOf(phone.countryForE164Number(value))) {
                return true
              }
            }
          }
        }
      } catch (e) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: e.message })
      }
    }
    return false
  }
}

// -------------------------------------------------

function EmailValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(EmailValidator, Validator)

EmailValidator.prototype.construct = function(type, options) {
  let allowNull = !!getOption(options, 'allowNull', true)
  return function(ac, node, v) {
    if (allowNull && (v == null || v === '')) {
      return true
    }
    return EmailValidator.validateEmail(v)
  }
}

EmailValidator.validateEmail = function(v) {
  return _.isString(v) && v.length >= 3 && !!v.match(Matchers.email) // a@a is minimum length
}

// -------------------------------------------------

function IPv4AddrOrCidrValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(IPv4AddrOrCidrValidator, Validator)

IPv4AddrOrCidrValidator.prototype.construct = function() {
  return function(ac, node, v) {
    return _.isString(v) && (isIPV4(v) || isCIDR(v))
  }
}

// -------------------------------------------------

function PasswordStrengthValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(PasswordStrengthValidator, Validator)

PasswordStrengthValidator.prototype.construct = function(type, options) {
  let minScore = Number(pathTo(options, 'minScore'))
  if (!isInt(minScore)) minScore = 0
  return function(ac, node, value) {

    const result = testPasswordStrength(value)
    return result.score >= minScore

  }
}

// -------------------------------------------------

function NumberValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(NumberValidator, Validator)

NumberValidator.prototype.construct = function(type, options) {

  let allowNull = !!getOption(options, 'allowNull', true),
      min = isInt(parseInt(pathTo(options, 'min'))) ? parseInt(options.min) : null,
      max = isInt(parseInt(pathTo(options, 'max'))) ? parseInt(options.max) : null,
      allowDecimal = !!getOption(options, 'allowDecimal', true),
      msg = 'Enter ' + (allowDecimal ? 'a number' : 'an integer'),
      suffix = '',
      errCode = this.errCode

  if (min != null && max != null) {
    if (max < min) max = min
    suffix = ' with a value between ' + min + ' and ' + max
    msg += suffix
  } else if (min != null) {
    suffix = ' with a value of at least ' + min
    msg += suffix
  } else if (max != null) {
    suffix = ' with a maximum value of ' + max
    msg += suffix
  }

  this.message = msg

  return function(ac, node, value) {
    if (value === null) return allowNull
    let ok
    if (allowDecimal) {
      ok = _.isNumber(value) && isFinite(value)
    } else {
      ok = isInt(value)
    }
    if (ok) {
      if (min != null && value < min) return false
      ok = !(max != null && value > max)
    }
    if (!ok) {
      throw Fault.create(errCode, { reason: msg })
    }
    return true
  }
}

// -------------------------------------------------

function CoordinateValidator(type, errCode, message, options) {

  this.asArray = true

  Validator.call(this, type, errCode, message, options)
}
util.inherits(CoordinateValidator, Validator)

CoordinateValidator.validateLngLat = function(value) {

  return _.isArray(value) &&
           value.length === 2 &&
           _.isNumber(value[0]) && isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 &&
           _.isNumber(value[1]) && isFinite(value[1]) && value[1] >= -90 && value[1] <= 90

}

CoordinateValidator.prototype.construct = function(type, options) {

  let min0 = isInt(parseInt(pathTo(options, 'min0'))) ? parseInt(options.min0) : null,
      max0 = isInt(parseInt(pathTo(options, 'max0'))) ? parseInt(options.max0) : null,
      min1 = isInt(parseInt(pathTo(options, 'min1'))) ? parseInt(options.min1) : null,
      max1 = isInt(parseInt(pathTo(options, 'max1'))) ? parseInt(options.max1) : null,
      allowDecimal0 = !!getOption(options, 'allowDecimal0', true),
      allowDecimal1 = !!getOption(options, 'allowDecimal1', true)

  const check = function(value) {

    if (!_.isArray(value) || value.length !== 2) {
      return false
    }

    if (allowDecimal0 && !(_.isNumber(value[0]) && isFinite(value[0]))) {
      return false
    } else if (!allowDecimal0 && !isInt(value[0])) {
      return false
    }
    if (allowDecimal1 && !(_.isNumber(value[1]) && isFinite(value[1]))) {
      return false
    } else if (!allowDecimal1 && !isInt(value[1])) {
      return false
    }

    if (min0 != null && value[0] < min0) {
      return false
    }
    if (max0 != null && value[0] > max0) {
      return false
    }

    if (min1 != null && value[1] < min1) {
      return false
    }
    return !(max1 != null && value[1] > max1)

  }

  return function(ac, node, value) {
    if (node.array) {
      if (!_.isArray(value)) {
        return false
      }
      return _.all(value, check)
    } else {
      return check(value)
    }
  }
}

// -------------------------------------------------

function DateValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(DateValidator, Validator)

DateValidator.prototype.construct = function(type, options) {

  let allowNull = !!getOption(options, 'allowNull', true),
      min = getValidDate(pathTo(options, 'min')),
      max = getValidDate(pathTo(options, 'max')),
      msg = 'Enter a valid date',
      suffix = '',
      errCode = this.errCode

  if (min != null && max != null) {
    if (max < min) max = min
    suffix = ' with a value between ' + min + ' and ' + max
    msg += suffix
  } else if (min != null) {
    suffix = ' with a value of at least ' + min
    msg += suffix
  } else if (max != null) {
    suffix = ' with a maximum value of ' + max
    msg += suffix
  }

  this.message = msg

  return function(ac, node, value) {
    if (value === null) return allowNull

    let date = getValidDate(value),
        ok = !!date

    if (ok) {
      if (min != null && date < min) return false
      ok = !(max != null && date > max)
    }
    if (!ok) {
      throw Fault.create(errCode, { reason: msg })
    }
    return true
  }
}

// -------------------------------------------------

function AllowLevelValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(AllowLevelValidator, Validator)

AllowLevelValidator.prototype.construct = function(type, options) {

  let includeNoAllow = !!pathTo(options, 'includeNoAllow'),
      defaultValue = pathTo(options, 'defaultValue')

  return function(ac, node, value) {
    return acl.fixAllowLevel(value, includeNoAllow, defaultValue) === value
  }
}

// -------------------------------------------------

function RequiredValidator(type, errCode, message, options) {

  Validator.call(this, type, errCode, message, options)
}
util.inherits(RequiredValidator, Validator)

RequiredValidator.prototype.construct = function(type) {

  let isMixed = type instanceof db.mongoose.SchemaTypes.Mixed

  type.isRequired = true

  if (type.instance === 'Array') {
    this.asArray = true
  }

  return function(ac, node, value) {

    // no validation when this path wasn't selected in the query.
    if ('isSelected' in this &&
            !this.isSelected(type.path) &&
            !this.isModified(type.path, this.modifiedPaths(true))) return true

    if (isMixed) {
      return value != null
    }

    const exists = node.checkRequired
      ? node.checkRequired.call(this, ac, node, type, value)
      : type.checkRequired(value, this)
    return exists
  }
}

// -------------------------------------------------

function PatternValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(PatternValidator, Validator)

PatternValidator.prototype.construct = function(type, options) {

  let allowNull = !!pathTo(options, 'allowNull'),
      allowEmpty = !!pathTo(options, 'allowEmpty'),
      pattern = pathTo(options, 'pattern'),
      match,
      regexp

  if (!_.isString(pattern) || pattern.length === 0 || !(match = pattern.match(/^\/(.*)\/(.*)/)) || match[0].length === 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid validator regex pattern', path: type.path })
  }

  try {
    regexp = new RegExp(match[1], match[2])
  } catch (e) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid validator regex pattern', path: type.path })
  }

  return function(ac, node, value) {
    return ((allowNull && value == null) || (allowEmpty && value === '') || (_.isString(value) && !!value.match(regexp)))
  }

}

function UrlValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(UrlValidator, Validator)

UrlValidator.prototype.construct = function(type, options) {

  let allowNull = !!pathTo(options, 'allowNull'),
      allowEmpty = !!pathTo(options, 'allowEmpty'),
      webOnly = !!pathTo(options, 'webOnly'),
      webSecure = rBool(pathTo(options, 'webSecure'), null)

  return function(ac, node, value) {

    if ((allowNull && value == null) || (allowEmpty && value === '')) {
      return true
    }
    if (_.isString(value)) {
      let fn = webOnly ? (webSecure == null ? 'isWebUri' : (webSecure ? 'isHttpsUri' : 'isHttpUri')) : 'isUri'
      return validUrl[fn](value)
    }
    return false
  }

}

// -------------------------------------------------

function JsonValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(JsonValidator, Validator)

JsonValidator.prototype.construct = function(type, options) {

  let schema = pathTo(options, 'schema'), valid = false
  try {
    json.validateSchema(schema)
    valid = true
  } catch (err) {
    logger.error('invalid json schema validator for ' + this.path)
  }

  if (!valid) {
    return Validator.prototype.construct.call(this, type, options)
  }

  return function(ac, node, value, callback) {
    try {
      value = JSON.parse(value._dat_)
    } catch (e) {
      setImmediate(callback, Fault.create('cortex.invalidArgument.invalidJSON'))
      return
    }
    json.validate(schema, value, function(err) {
      callback(err, !err)
    })
  }
}

// -------------------------------------------------

function JsonSchemaValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(JsonSchemaValidator, Validator)

JsonSchemaValidator.prototype.construct = function() {

  return function(ac, node, value, callback) {
    json.validateSchema(value, function(err) {
      callback(err, !err)
    })
  }
}

// -------------------------------------------------

function PrintableStringValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(PrintableStringValidator, Validator)

PrintableStringValidator.prototype.construct = function(type, options) {

  let anyFirstLetter = !!getOption(options, 'anyFirstLetter', false),
      allowNumberAsFirstLetter = !!getOption(options, 'allowNumberAsFirstLetter', true),
      max = rInt(pathTo(options, 'max'), 100),
      min = Math.min(rInt(pathTo(options, 'min'), 0), max)

  this.message = `Enter text between ${min} and ${max} characters in length`

  // CTXAPI-1197 - removed enforcement of this option. does not play nice with unicode. would require intense regex
  void anyFirstLetter

  return function(ac, node, value) {
    return _.isString(value) &&
           (value.length >= min && value.length <= max) &&
           !/[\x07\x1b\x0c\x0a\x0d\x09\x0b]+/.test(value) && // check for non-printable
           (allowNumberAsFirstLetter || !/^[0-9]/.test(value)) // check for possible number at the front.
  }

}

// -------------------------------------------------

function StringValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(StringValidator, Validator)

StringValidator.prototype.construct = function(type, options) {

  const max = rInt(pathTo(options, 'max'), 100),
        min = Math.min(rInt(pathTo(options, 'min'), 0), max),
        allowNull = getOption(options, 'allowNull', false)

  this.message = 'Enter text between ' + min + ' and ' + max + ' characters in length'

  return function(ac, node, value) {
    if (value === null && allowNull) {
      return true
    }
    return _.isString(value) && (value.length >= min && value.length <= max)
  }

}

// -------------------------------------------------

function ScriptValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(ScriptValidator, Validator)

ScriptValidator.prototype.construct = function(type, options) {

  this.asArray = false
  const compiled = options.compiled,
        requires = options.requires

  return function(ac, node, value, callback) {

    const sandboxed = modules.sandbox.sandboxed(ac,
      compiled,
      {
        skipTranspile: true,
        requires: requires,
        compilerOptions: {
          label: `Validate ${node.fqpp}`,
          type: 'validator',
          language: 'javascript',
          specification: 'es6'
        }
      },
      {
        value: value
      })

    sandboxed(callback)
  }

}

// -------------------------------------------------

function ExpressionValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(ExpressionValidator, Validator)

ExpressionValidator.prototype.construct = function(type, options) {

  const expression = modules.expressions.parseExpression(options)

  return async function(ac, node, value) {

    if (expression) {

      let err, result

      const start = profile.start()

      try {
        const ec = modules.expressions.createContext(
          ac,
          expression,
          {
            $$ROOT: {
              subject: ac.subject,
              value
            }
          }
        )
        result = await ec.evaluate()

      } catch (e) {
        err = e
      }

      profile.end(start, '[validation].expression')

      if (err) {
        throw err
      }
      return result

    }

    return false
  }

}

// -------------------------------------------------

function DateOfBirthValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(DateOfBirthValidator, Validator)

DateOfBirthValidator.prototype.construct = function() {

  return function(ac, node, value) {
    value = new Date(value)
    return value.toString() !== 'Invalid Date' && value >= DateOfBirthValidator.l899 && value <= new Date(Date.now() + 86400000)
  }

}
DateOfBirthValidator.l899 = new Date(Date.UTC(1899, 0, 1))

// -------------------------------------------------

function DateEnumValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(DateEnumValidator, Validator)

DateEnumValidator.prototype.construct = function(type, options) {
  let enumValues = toArray(pathTo(options, 'values')).map(v => { // <-- store as strings.
    v = getValidDate(v)
    if (v) {
      v = v.toISOString()
    }
    return v
  }).filter(v => v)
  this.message = 'One of: ' + enumValues.join(', ')
  return function(ac, node, value) {
    value = getValidDate(value)
    if (value) {
      return !!~enumValues.indexOf(value.toISOString())
    }
    return false
  }
}

// -------------------------------------------------

function IdEnumValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(IdEnumValidator, Validator)

IdEnumValidator.prototype.construct = function(type, options) {
  let enumValues = toArray(pathTo(options, 'values')).map(v => { // <-- store as strings.
    v = getIdOrNull(v)
    if (v) {
      v = v.toString()
    }
    return v
  }).filter(v => v)
  this.message = 'One of: ' + enumValues.join(', ')
  return function(ac, node, value) {
    value = getIdOrNull(value)
    if (value) {
      return !!~enumValues.indexOf(value.toString())
    }
    return false
  }
}

// -------------------------------------------------

function EnumValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(EnumValidator, Validator)

EnumValidator.prototype.construct = function(type, options) {

  let enumValues = toArray(pathTo(options, 'values'))

  this.message = 'One of: ' + enumValues.join(', ')

  return function(ac, node, value) {
    return !!~enumValues.indexOf(value)
  }

}

// ------------------------------------------------------------------------------

function OptionsValidator(type, errCode, message, options) {
  Validator.call(this, type, errCode, message, options)
}
util.inherits(OptionsValidator, Validator)

OptionsValidator.prototype.construct = function(type, options) {

  options = {
    values: toArray(pathTo(options, 'values')).map(v => {
      return v && v.value
    })
  }

  const typeName = type.options.propertyNode.getTypeName()

  let Cls
  if (typeName === 'Date') {
    Cls = DateEnumValidator
  } else if (typeName === 'ObjectId') {
    Cls = IdEnumValidator
  } else {
    Cls = EnumValidator
  }
  return Cls.prototype.construct.call(this, type, options)

}

function ValidatorTemplate(validatorClass, errCode, message, forTypes, expose, jsonSchema, onlyAsArray, cannotBeArray) {

  this.validatorClass = validatorClass
  this.forTypes = !forTypes ? true : toArray(forTypes, true)
  this.onlyAsArray = rBool(onlyAsArray, false)
  this.cannotBeArray = rBool(cannotBeArray, false)
  this.errCode = errCode
  this.message = message
  this.expose = _.isFunction(expose) ? expose : Boolean(expose)
  if (this.expose && jsonSchema) {
    if (_.isFunction(jsonSchema)) {
      this.jsonSchema = jsonSchema
    } else {
      try {
        json.validateSchema(jsonSchema)
        this.jsonSchema = jsonSchema
      } catch (err) {
        logger.error('compiling validator schema for ' + errCode, err.message)
        this.expose = false
      }
    }
  }

}

ValidatorTemplate.prototype.create = function(type, options) {
  let Cls = this.validatorClass
  return new Cls(type, this.errCode, this.message, options)
}

ValidatorTemplate.prototype.validateOptions = function(schema, options) {
  if (this.jsonSchema) {
    if (_.isFunction(this.jsonSchema)) {
      this.jsonSchema(schema, options)
    } else {
      json.validate(this.jsonSchema, options)
    }
  }
  return true
}

module.exports = {

  Validator: Validator, // @temp for conversion

  Matchers: Matchers,

  adhoc: function(definition) {
    return new AdHocValidator(null, null, null, definition)
  },

  okForType: function(name, type, array) {
    let template = validation.validators[name]
    if (template) {
      if (template.onlyAsArray && !array) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Unsupported type for validator. Property must be an array.' })
      }
      if (template.cannotBeArray && array) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Unsupported type for validator. Property cannot be an array.' })
      }
      type = definitions.nodeTypeToMongooseType(type) || type // Could be Cortex type (ie. Reference)
      if (!_.isArray(template.forTypes) || ~template.forTypes.indexOf(type)) {
        return true
      }
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Unsupported type for validator.' })
    }
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Unsupported validator.' })
  },

  create: function(name, schemaType, options) {

    let template = validation.validators[name]
    if (template) {
      let isArray = _.isArray(schemaType.options.type),
          type = isArray ? schemaType.options.type[0] : schemaType.options.type

      if (template.onlyAsArray && !isArray) {
        throw new Error('Unsupported type for validator. Property must be an array.')
      }
      if (template.cannotBeArray && isArray) {
        throw new Error('Unsupported type for validator. Property cannot be an array.')
      }
      if (type) {
        if (!_.isString(type)) {
          type = type.name
        }
        if (_.isArray(template.forTypes) && !~template.forTypes.indexOf(type)) {
          throw new Error('Unsupported type for validator.')
        }
      }
      return template.create(schemaType, options)
    } else {
      logger.error(`validator (${name}) not found for path (${schemaType.path})`)
    }
    return null

  },

  validators: {
    adhoc: new ValidatorTemplate(
      AdHocValidator,
      'cortex.invalidArgument.unspecified',
      'Invalid Argument',
      null
    ),
    email: new ValidatorTemplate(
      EmailValidator,
      'cortex.invalidArgument.emailFormat',
      'Invalid email address format',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          allowNull: {
            // description: 'Allow blank or null entries',
            type: 'boolean',
            default: true
          }
        },
        additionalProperties: false
      }
    ),
    locale: new ValidatorTemplate(
      LocaleValidator,
      'cortex.invalidArgument.locale',
      'Invalid locale',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          allowNull: {
            // description: 'Allow blank or null entries',
            type: 'boolean',
            default: false
          },
          allowBlank: {
            // description: 'Allow blank values',
            type: 'boolean',
            default: false
          },
          locales: {
            // description: 'list of valid locales to use as an enum',
            type: 'array',
            minItems: 0,
            maxItems: 1024,
            items: {
              type: 'string'
            },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ),
    passwordStrength: new ValidatorTemplate(
      PasswordStrengthValidator,
      'cortex.invalidArgument.passwordStrength',
      'The chosen password does not meet the minimum password strength requirement',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          minScore: {
            // description: 'Minimum password score (0,1,2,3,4)',
            type: 'integer',
            minimum: 0,
            maximum: 4
          }
        },
        required: ['minScore'],
        additionalProperties: false
      }
    ),
    fingerprint: new ValidatorTemplate(
      FingerprintValidator,
      'cortex.invalidArgument.locationFingerprint',
      'Invalid location fingerprint',
      'String',
      false
    ),
    IPv4AddrOrCidr: new ValidatorTemplate(
      IPv4AddrOrCidrValidator,
      'cortex.invalidArgument.iPv4AddrOrCidr',
      'Invalid IPv4 address or IPv4 CIDR range',
      'String',
      true
    ),
    npi: new ValidatorTemplate(
      NpiValidator,
      'cortex.invalidArgument.npi',
      'Invalid NPI number',
      'String',
      false
    ),
    phoneNumber: new ValidatorTemplate(
      PhoneNumberValidator,
      'cortex.invalidArgument.phoneNumberFormat',
      'Invalid phone number',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          allowNull: {
            // description: 'Allow null entries.',
            type: 'boolean',
            default: false
          },
          requireMobile: {
            // description: 'If true, requires the number to be a mobile number.',
            type: 'boolean',
            default: false
          },
          autoFormat: {
            type: 'boolean',
            default: true
          },
          allowShortCode: {
            type: 'boolean',
            default: false
          },
          allowedCountries: {
            // description: 'a list of allowed countries.',
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'string',
              enum: phoneUtil.getSupportedRegions()
            },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ),
    number: new ValidatorTemplate(
      NumberValidator,
      'cortex.invalidArgument.numberExpected',
      'Number out of range',
      'Number',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          allowNull: {
            // description: 'Allow null entries',
            type: 'boolean',
            default: false
          },
          min: {
            // description: 'min value',
            type: 'integer'
          },
          max: {
            // description: 'max value',
            type: 'integer'
          },
          allowDecimal: {
            // description: 'Allow float values',
            type: 'boolean',
            default: true
          }
        },
        additionalProperties: false
      }
    ),
    date: new ValidatorTemplate(
      DateValidator,
      'cortex.invalidArgument.date',
      'Date value expected',
      'Date',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          allowNull: {
            // description: 'Allow null entries',
            type: 'boolean',
            default: false
          },
          min: {
            // description: 'min value',
            type: 'date'
          },
          max: {
            // description: 'max value',
            type: 'date'
          }
        },
        additionalProperties: false
      }
    ),
    allowLevel: new ValidatorTemplate(
      AllowLevelValidator,
      'cortex.invalidArgument.allowLevel',
      'Invalid allowLevel',
      'Number',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          includeNoAllow: {
            // description: 'Allow acl.AccessLevels.None. If false, acl.AccessLevels.Public is the minimum allowed',
            type: 'boolean',
            default: false
          },
          defaultValue: {
            // description: 'an optional default value',
            type: 'integer',
            enum: _.uniq(_.values(acl.AccessLevels)).sort()
          }
        },
        additionalProperties: false
      }
    ),
    required: new ValidatorTemplate(
      RequiredValidator,
      'cortex.invalidArgument.required',
      'Required property',
      null,
      true
    ),
    url: new ValidatorTemplate(
      UrlValidator,
      'cortex.invalidArgument.url',
      'Invalid URL',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          allowNull: {
            // description: 'Allow null values.',
            type: 'boolean',
            default: false
          },
          allowEmpty: {
            // description: 'Allow 0-length strings',
            type: 'boolean',
            default: false
          },
          webOnly: {
            // description: 'Url must be a web url, beginning with http:// or https://',
            type: 'boolean',
            default: true
          },
          webSecure: {
            // description: 'Applies when webOnly is true. If present, url must either be https:// (true) or http:// (false). Omitting this property allows either.',
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ),
    pattern: new ValidatorTemplate(
      PatternValidator,
      'cortex.invalidArgument.string',
      'Invalid string',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          allowNull: {
            // description: 'Allow null values.',
            type: 'boolean',
            default: false
          },
          allowEmpty: {
            // description: 'Allow 0-length strings',
            type: 'boolean',
            default: false
          },
          pattern: {
            // description: 'The regex pattern to test against the incoming string value',
            type: 'regex'
          }
        },
        additionalProperties: false,
        required: ['pattern']
      }
    ),
    json: new ValidatorTemplate(
      JsonValidator,
      'cortex.invalidArgument.invalidJSON',
      'Invalid JSON document',
      'Mixed',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          schema: {
            // description: 'A draft-04 json schema against which to validate the input',
            type: ['schema']
          }
        },
        required: ['schema'],
        additionalProperties: false
      }
    ),
    jsonSchema: new ValidatorTemplate(
      JsonSchemaValidator,
      'cortex.invalidArgument.JSONSchema',
      'Invalid JSON Schema',
      'Mixed',
      true
    ),
    string: new ValidatorTemplate(
      StringValidator,
      'cortex.invalidArgument.invalidString',
      'Invalid string',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          min: {
            // description: 'min length',
            type: 'integer',
            default: 0,
            minimum: 0
          },
          max: {
            // description: 'max length',
            type: 'integer'
          },
          allowNull: {
            // description: 'Allow null entries',
            type: 'boolean',
            default: false
          }
        },
        required: ['min', 'max'],
        additionalProperties: false
      }
    ),
    printableString: new ValidatorTemplate(
      PrintableStringValidator,
      'cortex.invalidArgument.invalidString',
      'Invalid string',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          anyFirstLetter: {
            // description: 'Allow the first letter of the string to be non-alphanumeric.',
            type: 'boolean',
            default: true
          },
          allowNumberAsFirstLetter: {
            // description: 'Allows a number as the first letter of the string',
            type: 'boolean',
            default: true
          },
          min: {
            // description: 'min length',
            type: 'integer',
            default: 0,
            minimum: 0
          },
          max: {
            // description: 'max length',
            type: 'integer'
          }
        },
        required: ['min', 'max'],
        additionalProperties: false
      }
    ),
    dateOfBirth: new ValidatorTemplate(
      DateOfBirthValidator,
      'cortex.invalidArgument.dateOfBirth',
      'Must be a valid date string format and not in the future',
      ['String', 'Date'],
      true
    ),
    coordinate: new ValidatorTemplate(
      CoordinateValidator,
      'cortex.invalidArgument.invalidCoordinate',
      'Must be a valid 2 element coordinate array',
      ['Number'],
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          min0: {
            // description: 'min value',
            type: 'integer'
          },
          max0: {
            // description: 'max value',
            type: 'integer'
          },
          min1: {
            // description: 'min value',
            type: 'integer'
          },
          max1: {
            // description: 'max value',
            type: 'integer'
          },
          allowDecimal0: {
            // description: 'Allow float values',
            type: 'boolean',
            default: true
          },
          allowDecimal1: {
            // description: 'Allow float values',
            type: 'boolean',
            default: true
          }
        },
        additionalProperties: false
      },
      true
    ),
    uniqueInArray: new ValidatorTemplate(
      UniqueInArrayValidator,
      'cortex.conflict.uniqueInArray',
      'Must be a unique array element',
      ['Date', 'String', 'Number', 'ObjectId', 'Reference', 'Buffer'],
      true
    ),
    stringEnum: new ValidatorTemplate(
      EnumValidator,
      'cortex.invalidArgument.enumValue',
      'String not found in list',
      'String',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          values: {
            // description: 'An array of possible entries',
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'string' }
          }
        },
        required: ['values'],
        additionalProperties: false
      }
    ),
    dotPath: new ValidatorTemplate(
      DotPathValidator,
      'cortex.invalidArgument.dotPath',
      'A valid dot path value',
      'String',
      true
    ),
    customName: new ValidatorTemplate(
      CustomNameValidator,
      'cortex.invalidArgument.customName',
      'A valid custom/namespaced name value',
      'String',
      true
    ),
    writeOnce: new ValidatorTemplate(
      WriteOnceValidator,
      'cortex.accessDenied.writeOnce',
      'Value can only be set once',
      ['Date', 'Binary', 'Boolean', 'String', 'Number', 'ObjectId', 'Expression'],
      true,
      null,
      false,
      true
    ),
    numberEnum: new ValidatorTemplate(
      EnumValidator,
      'cortex.invalidArgument.enumValue',
      'Number not found in list',
      'Number',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          values: {
            // description: 'An array of possible entries',
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'number' }
          }
        },
        required: ['values'],
        additionalProperties: false
      }
    ),
    idEnum: new ValidatorTemplate(
      IdEnumValidator,
      'cortex.invalidArgument.enumValue',
      'ObjectId not found in list',
      'ObjectId',
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          values: {
            // description: 'An array of possible entries',
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'objectId' }
          }
        },
        required: ['values'],
        additionalProperties: false
      }
    ),
    dateEnum: new ValidatorTemplate(
      DateEnumValidator,
      'cortex.invalidArgument.enumValue',
      'Date not found in list',
      ['Date'],
      true,
      {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          values: {
            // description: 'An array of possible entries',
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'date' }
          }
        },
        required: ['values'],
        additionalProperties: false
      }
    ),
    options: new ValidatorTemplate(
      OptionsValidator,
      'cortex.invalidArgument.enumValue',
      'Select an option from the list',
      ['Date', 'String', 'Number', 'ObjectId'],
      true,
      function(schema, definition) {

        let theType = {
          String: 'string',
          Date: 'date',
          ObjectId: 'objectId',
          Number: 'number'
        }[schema.node.parent.name]

        const jsonSchema = {
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'object',
          properties: {
            values: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100
                  },
                  value: {
                    type: theType
                  }
                },
                required: ['label', 'value'],
                additionalProperties: false
              }
            }
          },
          required: ['values'],
          additionalProperties: false
        }

        if (theType === 'string') {
          jsonSchema.properties.values.items.properties.value.maxLength = 100
        }

        json.validate(jsonSchema, definition)
        return true

      }
    ),
    authScope: new ValidatorTemplate(
      AuthScopeValidator,
      'cortex.invalidArgument.authScope',
      'An authentication scope is invalid',
      'String',
      true,
      null,
      true
    ),
    timeZone: new ValidatorTemplate(
      TimeZoneValidator,
      'cortex.invalidArgument.timeZone',
      'Please enter a valid time zone',
      'String',
      true,
      null,
      false
    ),
    script: new ValidatorTemplate(
      ScriptValidator,
      'cortex.invalidArgument.unspecified',
      null,
      'String',
      function(ac, node, value) {
        return rBool(pathTo(ac.org, 'configuration.scripting.enableValidators'), config('sandbox.limits.enableValidators'))
      },
      null,
      false
    ),
    expression: new ValidatorTemplate(
      ExpressionValidator,
      'cortex.invalidArgument.unspecified',
      null,
      null,
      true,
      (schema, definition) => {
        modules.expressions.parseExpression(definition)
        return true
      }
    )
  },

  isEmail: EmailValidator.validateEmail,
  isLngLat: CoordinateValidator.validateLngLat,
  formatCustomName: CustomNameValidator.formatter,
  isShortCode: PhoneNumberValidator.isShortCode,
  isDotPath: DotPathValidator.isDotPath

}

validation = module.exports

validation.exposed = Object.keys(validation.validators).filter(function(key) { return !!validation.validators[key].expose }).sort()

validation.createValidators = function(schema, validators) {

  return validators.map(function(v) {

    let validator = _.isArray(v) ? v[0] : v,
        options = _.isArray(v) ? v[1] : null

    if (validator instanceof Validator) {
      return validator
    }

    try {
      return validation.create(validator, schema, options)
    } catch (err) {
      return null
    }

  }).filter(function(validator) { return !!validator })

}
