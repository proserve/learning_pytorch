/* eslint-disable */

/**
 * jjv.js -- A javascript library to validate json input through a json-schema.
 * Copyright (c) 2013 Alex Cornejo.
 * Redistributable under a MIT-style open source license.
 *
 *
 */

import clone from 'clone'
import { couldBeId } from 'util.id'

const clone_stack = function(stack) {
  const new_stack = [ clone(stack[0]) ]
  let key = new_stack[0].key,
      obj = new_stack[0].object
  for (let i = 1, len = stack.length; i < len; i++) {
    obj = obj[key]
    key = stack[i].key
    new_stack.push({ object: obj, key: key })
  }
  return new_stack
}

const copy_stack = function(new_stack, old_stack) {
  const stack_last = new_stack.length - 1, key = new_stack[stack_last].key
  old_stack[stack_last].object[key] = new_stack[stack_last].object[key]
}

const handled = {
  'type': true,
  'not': true,
  'anyOf': true,
  'allOf': true,
  'oneOf': true,
  '$ref': true,
  '$schema': true,
  'id': true,
  'exclusiveMaximum': true,
  'exclusiveMininum': true,
  'properties': true,
  'patternProperties': true,
  'additionalProperties': true,
  'items': true,
  'additionalItems': true,
  'required': true,
  'default': true,
  'title': true,
  'description': true,
  'definitions': true,
  'dependencies': true
}

const fieldType = {
  'null': function(x) {
    return x === null
  },
  'string': function(x) {
    return typeof x === 'string'
  },
  'boolean': function(x) {
    return typeof x === 'boolean'
  },
  'number': function(x) {
    // Use x === x instead of !isNaN(x) for speed
    return typeof x === 'number' && x === x
  },
  'integer': function(x) {
    return typeof x === 'number' && x % 1 === 0
  },
  'object': function(x) {
    return x && typeof x === 'object' && !Array.isArray(x)
  },
  'array': function(x) {
    return Array.isArray(x)
  },
  'date': function(x) {
    return !!x && typeof x === 'object' && Object.prototype.toString.call(x) === '[object Date]'
  }
}

// missing: uri, date-time, ipv4, ipv6
const fieldFormat = {
  'alpha': function(v) {
    return (/^[a-zA-Z]+$/).test(v)
  },
  'alphanumeric': function(v) {
    return (/^[a-zA-Z0-9]+$/).test(v)
  },
  'identifier': function(v) {
    return (/^[-_a-zA-Z0-9]+$/).test(v)
  },
  'hexadecimal': function(v) {
    return (/^[a-fA-F0-9]+$/).test(v)
  },
  'numeric': function(v) {
    return (/^[0-9]+$/).test(v)
  },
  'date-time': function(v) {
    return !isNaN(Date.parse(v)) && v.indexOf('/') === -1
  },
  'uppercase': function(v) {
    return v === v.toUpperCase()
  },
  'lowercase': function(v) {
    return v === v.toLowerCase()
  },
  'hostname': function(v) {
    return v.length < 256 && (/^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$/).test(v)
  },
  'uri': function(v) {
    return (/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/).test(v)
  },
  'email': function(v) { // email, ipv4 and ipv6 adapted from node-validator
    return (/^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/).test(v)
  },
  'phone': function(v) { // matches most European and US representations like +49 123 999 or 0001 123.456 or +31 (0) 8123
    return (/^(?:\+\d{1,3}|0\d{1,3}|00\d{1,2})?(?:\s?\(\d+\))?(?:[-\/\s.]|\d)+$/).test(v)
  },
  'ipv4': function(v) {
    if ((/^(\d?\d?\d)\.(\d?\d?\d)\.(\d?\d?\d)\.(\d?\d?\d)$/).test(v)) {
      const parts = v.split('.').sort()
      if (parts[3] <= 255) { return true }
    }
    return false
  },
  'ipv6': function(v) {
    return (/^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/).test(v)
    /*  return (/^::|^::1|^([a-fA-F0-9]{1,4}::?){1,7}([a-fA-F0-9]{1,4})$/).test(v); */
  }
}

const fieldValidate = {
  'readOnly': function() {
    return false
  },
  // ****** numeric validation ********
  'minimum': function(v, p, schema) {
    return !(v < p || schema.exclusiveMinimum && v <= p)
  },
  'maximum': function(v, p, schema) {
    return !(v > p || schema.exclusiveMaximum && v >= p)
  },
  'multipleOf': function(v, p) {
    return (v / p) % 1 === 0 || typeof v !== 'number'
  },
  // ****** string validation ******
  'pattern': function(v, p) {
    if (typeof v !== 'string') { return true }
    let pattern, modifiers
    if (typeof p === 'string') { pattern = p } else {
      pattern = p[0]
      modifiers = p[1]
    }
    const regex = new RegExp(pattern, modifiers)
    return regex.test(v)
  },
  'minLength': function(v, p) {
    return v.length >= p || typeof v !== 'string'
  },
  'maxLength': function(v, p) {
    return v.length <= p || typeof v !== 'string'
  },
  // ***** array validation *****
  'minItems': function(v, p) {
    return v.length >= p || !Array.isArray(v)
  },
  'maxItems': function(v, p) {
    return v.length <= p || !Array.isArray(v)
  },
  'uniqueItems': function(v) {
    const hash = {}
    for (let i = 0, len = v.length; i < len; i++) {
      let key = JSON.stringify(v[i])
      if (hash.hasOwnProperty(key)) { return false } else { hash[key] = true }
    }
    return true
  },
  // ***** object validation ****
  'minProperties': function(v, p) {
    if (typeof v !== 'object') { return true }
    let count = 0
    for (let attr in v) if (v.hasOwnProperty(attr)) count = count + 1
    return count >= p
  },
  'maxProperties': function(v, p) {
    if (typeof v !== 'object') { return true }
    let count = 0
    for (let attr in v) if (v.hasOwnProperty(attr)) count = count + 1
    return count <= p
  },
  // ****** all *****
  'constant': function(v, p) {
    return JSON.stringify(v) === JSON.stringify(p)
  },
  'enum': function(v, p) {
    if (typeof v === 'object') {
      const vs = JSON.stringify(v)
      for (let i = 0, len = p.length; i < len; i++) {
        if (vs === JSON.stringify(p[i])) { return true }
      }
    } else {
      for (let i = 0, len = p.length; i < len; i++) {
        if (v === p[i]) { return true }
      }
    }
    return false
  }
}

const normalizeID = function(id) {
  return id.indexOf('://') === -1 ? id : id.split('#')[0]
}

const resolveURI = function(env, schema_stack, uri) {
  let curschema, components, hash_idx, name

  hash_idx = uri.indexOf('#')

  if (hash_idx === -1) {
    if (!env.schema.hasOwnProperty(uri)) { return null }
    return [env.schema[uri]]
  }

  if (hash_idx > 0) {
    name = uri.substr(0, hash_idx)
    uri = uri.substr(hash_idx + 1)
    if (!env.schema.hasOwnProperty(name)) {
      if (schema_stack && schema_stack[0].id === name) { schema_stack = [schema_stack[0]] } else { return null }
    } else { schema_stack = [env.schema[name]] }
  } else {
    if (!schema_stack) { return null }
    uri = uri.substr(1)
  }

  if (uri === '') { return [schema_stack[0]] }

  if (uri.charAt(0) === '/') {
    uri = uri.substr(1)
    curschema = schema_stack[0]
    components = uri.split('/')
    while (components.length > 0) {
      if (!curschema.hasOwnProperty(components[0])) { return null }
      curschema = curschema[components[0]]
      schema_stack.push(curschema)
      components.shift()
    }
    return schema_stack
  } else // FIX: should look for subschemas whose id matches uri
  { return null }
}

const resolveObjectRef = function(object_stack, uri) {
  let components, object, last_frame = object_stack.length - 1, skip_frames, frame, m = /^(\d+)/.exec(uri)

  if (m) {
    uri = uri.substr(m[0].length)
    skip_frames = parseInt(m[1], 10)
    if (skip_frames < 0 || skip_frames > last_frame) { return }
    frame = object_stack[last_frame - skip_frames]
    if (uri === '#') { return frame.key }
  } else { frame = object_stack[0] }

  object = frame.object[frame.key]

  if (uri === '') { return object }

  if (uri.charAt(0) === '/') {
    uri = uri.substr(1)
    components = uri.split('/')
    while (components.length > 0) {
      components[0] = components[0].replace(/~1/g, '/').replace(/~0/g, '~')
      if (!object.hasOwnProperty(components[0])) { return }
      object = object[components[0]]
      components.shift()
    }
    return object
  }
}

const checkValidity = function(env, schema_stack, object_stack, options) {
  let i, len, count, hasProp, hasPattern
  let p, v, malformed = false, objerrs = {}, objerr, props, matched
  let sl = schema_stack.length - 1, schema = schema_stack[sl], new_stack
  let ol = object_stack.length - 1, object = object_stack[ol].object, name = object_stack[ol].key, prop = object[name]
  let errCount, minErrCount

  if (schema.hasOwnProperty('$ref')) {
    schema_stack = resolveURI(env, schema_stack, schema.$ref)
    if (!schema_stack) { return {'$ref': schema.$ref} } else { return env.checkValidity(env, schema_stack, object_stack, options) }
  }

  if (schema.hasOwnProperty('type')) {
    if (typeof schema.type === 'string') {
      if (options.useCoerce && env.coerceType.hasOwnProperty(schema.type)) { prop = object[name] = env.coerceType[schema.type](prop) }
      if (options.useDefault && schema.default) {
        if ((prop === undefined || prop === null || prop === '') ||
                    (schema.type === 'array' && !prop.length && Array.isArray(prop)) ||
                    (schema.type === 'object' && JSON.stringify(prop) === JSON.stringify({}))) {
          prop = object[name] = clone(schema.default)
        }
      }
      if (!env.fieldType[schema.type](prop)) { return {'type': schema.type} }
    } else {
      malformed = true
      for (i = 0, len = schema.type.length; i < len && malformed; i++) {
        if (env.fieldType[schema.type[i]](prop)) { malformed = false }
      }
      if (malformed) { return {'type': schema.type} }
    }
  }

  if (schema.hasOwnProperty('allOf')) {
    for (i = 0, len = schema.allOf.length; i < len; i++) {
      objerr = env.checkValidity(env, schema_stack.concat(schema.allOf[i]), object_stack, options)
      if (objerr) { return objerr }
    }
  }

  if (!options.useCoerce && !options.useDefault && !options.removeAdditional) {
    if (schema.hasOwnProperty('oneOf')) {
      minErrCount = Infinity
      for (i = 0, len = schema.oneOf.length, count = 0; i < len; i++) {
        objerr = env.checkValidity(env, schema_stack.concat(schema.oneOf[i]), object_stack, options)
        if (!objerr) {
          count = count + 1
          if (count > 1) { break }
        } else {
          errCount = objerr.schema ? Object.keys(objerr.schema).length : 1
          if (errCount < minErrCount) {
            minErrCount = errCount
            objerrs = objerr
          }
        }
      }
      if (count > 1) { return {'oneOf': true} } else if (count < 1) { return objerrs }
      objerrs = {}
    }

    if (schema.hasOwnProperty('anyOf')) {
      objerrs = null
      minErrCount = Infinity
      for (i = 0, len = schema.anyOf.length; i < len; i++) {
        objerr = env.checkValidity(env, schema_stack.concat(schema.anyOf[i]), object_stack, options)
        if (!objerr) {
          objerrs = null
          break
        } else {
          errCount = objerr.schema ? Object.keys(objerr.schema).length : 1
          if (errCount < minErrCount) {
            minErrCount = errCount
            objerrs = objerr
          }
        }
      }
      if (objerrs) { return objerrs }
    }

    if (schema.hasOwnProperty('not')) {
      objerr = env.checkValidity(env, schema_stack.concat(schema.not), object_stack, options)
      if (!objerr) { return {'not': true} }
    }
  } else {
    if (schema.hasOwnProperty('oneOf')) {
      minErrCount = Infinity
      for (i = 0, len = schema.oneOf.length, count = 0; i < len; i++) {
        new_stack = clone_stack(object_stack)
        objerr = env.checkValidity(env, schema_stack.concat(schema.oneOf[i]), new_stack, options)
        if (!objerr) {
          count = count + 1
          if (count > 1) { break } else { copy_stack(new_stack, object_stack) }
        } else {
          errCount = objerr.schema ? Object.keys(objerr.schema).length : 1
          if (errCount < minErrCount) {
            minErrCount = errCount
            objerrs = objerr
          }
        }
      }
      if (count > 1) { return {'oneOf': true} } else if (count < 1) { return objerrs }
      objerrs = {}
    }

    if (schema.hasOwnProperty('anyOf')) {
      objerrs = null
      minErrCount = Infinity
      for (i = 0, len = schema.anyOf.length; i < len; i++) {
        new_stack = clone_stack(object_stack)
        objerr = env.checkValidity(env, schema_stack.concat(schema.anyOf[i]), new_stack, options)
        if (!objerr) {
          copy_stack(new_stack, object_stack)
          objerrs = null
          break
        } else {
          errCount = objerr.schema ? Object.keys(objerr.schema).length : 1
          if (errCount < minErrCount) {
            minErrCount = errCount
            objerrs = objerr
          }
        }
      }
      if (objerrs) { return objerrs }
    }

    if (schema.hasOwnProperty('not')) {
      new_stack = clone_stack(object_stack)
      objerr = env.checkValidity(env, schema_stack.concat(schema.not), new_stack, options)
      if (!objerr) { return {'not': true} }
    }
  }

  if (schema.hasOwnProperty('dependencies')) {
    for (p in schema.dependencies) {
      if (schema.dependencies.hasOwnProperty(p) && prop.hasOwnProperty(p)) {
        if (Array.isArray(schema.dependencies[p])) {
          for (i = 0, len = schema.dependencies[p].length; i < len; i++) {
            if (!prop.hasOwnProperty(schema.dependencies[p][i])) {
              return {'dependencies': true}
            }
          }
        } else {
          objerr = env.checkValidity(env, schema_stack.concat(schema.dependencies[p]), object_stack, options)
          if (objerr) { return objerr }
        }
      }
    }
  }

  if (!Array.isArray(prop)) {
    props = []
    objerrs = {}
    for (p in prop) {
      if (prop.hasOwnProperty(p)) { props.push(p) }
    }

    if (options.checkRequired && schema.required) {
      for (i = 0, len = schema.required.length; i < len; i++) {
        if (!prop.hasOwnProperty(schema.required[i])) {
          objerrs[schema.required[i]] = {'required': true}
          malformed = true
        }
      }
    }

    hasProp = schema.hasOwnProperty('properties')
    hasPattern = schema.hasOwnProperty('patternProperties')
    if (hasProp || hasPattern) {
      i = props.length
      while (i--) {
        matched = false
        if (hasProp && schema.properties.hasOwnProperty(props[i])) {
          matched = true
          objerr = env.checkValidity(env, schema_stack.concat(schema.properties[props[i]]), object_stack.concat({object: prop, key: props[i]}), options)
          if (objerr !== null) {
            objerrs[props[i]] = objerr
            malformed = true
          }
        }
        if (hasPattern) {
          for (p in schema.patternProperties) {
            if (schema.patternProperties.hasOwnProperty(p) && props[i].match(p)) {
              matched = true
              objerr = env.checkValidity(env, schema_stack.concat(schema.patternProperties[p]), object_stack.concat({object: prop, key: props[i]}), options)
              if (objerr !== null) {
                objerrs[props[i]] = objerr
                malformed = true
              }
            }
          }
        }
        if (matched) { props.splice(i, 1) }
      }
    }

    if (options.useDefault && hasProp && !malformed) {
      for (p in schema.properties) {
        if (schema.properties.hasOwnProperty(p) && !prop.hasOwnProperty(p) && schema.properties[p].hasOwnProperty('default')) { prop[p] = clone(schema.properties[p]['default']) } else if (schema.properties[p] && schema.properties[p].items && !prop.hasOwnProperty(p) && schema.properties[p].items.hasOwnProperty('default')) { prop[p] = clone(schema.properties[p].items['default']) }
      }
    }

    if (options.removeAdditional && hasProp && schema.additionalProperties !== true && typeof schema.additionalProperties !== 'object') {
      for (i = 0, len = props.length; i < len; i++) { delete prop[props[i]] }
    } else {
      if (schema.hasOwnProperty('additionalProperties')) {
        if (typeof schema.additionalProperties === 'boolean') {
          if (!schema.additionalProperties) {
            for (i = 0, len = props.length; i < len; i++) {
              objerrs[props[i]] = {'additional': true}
              malformed = true
            }
          }
        } else {
          for (i = 0, len = props.length; i < len; i++) {
            objerr = env.checkValidity(env, schema_stack.concat(schema.additionalProperties), object_stack.concat({object: prop, key: props[i]}), options)
            if (objerr !== null) {
              objerrs[props[i]] = objerr
              malformed = true
            }
          }
        }
      }
    }
    if (malformed) { return {'schema': objerrs} }
  } else {
    if (schema.hasOwnProperty('items')) {
      if (Array.isArray(schema.items)) {
        for (i = 0, len = schema.items.length; i < len; i++) {
          objerr = env.checkValidity(env, schema_stack.concat(schema.items[i]), object_stack.concat({object: prop, key: i}), options)
          if (objerr !== null) {
            objerrs[i] = objerr
            malformed = true
          }
        }
        if (prop.length > len && schema.hasOwnProperty('additionalItems')) {
          if (typeof schema.additionalItems === 'boolean') {
            if (!schema.additionalItems) { return {'additionalItems': true} }
          } else {
            for (i = len, len = prop.length; i < len; i++) {
              objerr = env.checkValidity(env, schema_stack.concat(schema.additionalItems), object_stack.concat({object: prop, key: i}), options)
              if (objerr !== null) {
                objerrs[i] = objerr
                malformed = true
              }
            }
          }
        }
      } else {
        for (i = 0, len = prop.length; i < len; i++) {
          objerr = env.checkValidity(env, schema_stack.concat(schema.items), object_stack.concat({object: prop, key: i}), options)
          if (objerr !== null) {
            objerrs[i] = objerr
            malformed = true
          }
        }
      }
    } else if (schema.hasOwnProperty('additionalItems')) {
      if (typeof schema.additionalItems !== 'boolean') {
        for (i = 0, len = prop.length; i < len; i++) {
          objerr = env.checkValidity(env, schema_stack.concat(schema.additionalItems), object_stack.concat({object: prop, key: i}), options)
          if (objerr !== null) {
            objerrs[i] = objerr
            malformed = true
          }
        }
      }
    }
    if (malformed) { return {'schema': objerrs} }
  }

  for (v in schema) {
    if (schema.hasOwnProperty(v) && !handled.hasOwnProperty(v)) {
      if (v === 'format') {
        if (env.fieldFormat.hasOwnProperty(schema[v]) && !env.fieldFormat[schema[v]](prop, schema, object_stack, options)) {
          objerrs[v] = true
          malformed = true
        }
      } else {
        if (env.fieldValidate.hasOwnProperty(v) && !env.fieldValidate[v](prop, schema[v].hasOwnProperty('$data') ? resolveObjectRef(object_stack, schema[v].$data) : schema[v], schema, object_stack, options)) {
          objerrs[v] = true
          malformed = true
        }
      }
    }
  }

  if (malformed) { return objerrs } else { return null }
}

const defaultOptions = {
  useDefault: false,
  useCoerce: false,
  checkRequired: true,
  removeAdditional: false
}

function Environment() {
  if (!(this instanceof Environment)) { return new Environment() }

  this.coerceType = {}
  this.fieldType = clone(fieldType)
  this.fieldValidate = clone(fieldValidate)
  this.fieldFormat = clone(fieldFormat)
  this.defaultOptions = clone(defaultOptions)
  this.schema = {}
}

Environment.prototype = {
  checkValidity: checkValidity,
  validate: function(name, object, options) {
    let schema_stack = [name], errors, object_stack = [{object: {'__root__': object}, key: '__root__'}]

    if (typeof name === 'string') {
      schema_stack = resolveURI(this, null, name)
      if (!schema_stack) { throw new Error('jjv: could not find schema \'' + name + '\'.') }
    }

    if (!options) {
      options = this.defaultOptions
    } else {
      for (let p in this.defaultOptions) {
        if (this.defaultOptions.hasOwnProperty(p) && !options.hasOwnProperty(p)) { options[p] = this.defaultOptions[p] }
      }
    }

    errors = this.checkValidity(this, schema_stack, object_stack, options)

    if (errors) { return {validation: errors.hasOwnProperty('schema') ? errors.schema : errors} } else { return null }
  },

  resolveRef: function(schema_stack, $ref) {
    return resolveURI(this, schema_stack, $ref)
  },

  addType: function(name, func) {
    this.fieldType[name] = func
  },

  addTypeCoercion: function(type, func) {
    this.coerceType[type] = func
  },

  addCheck: function(name, func) {
    this.fieldValidate[name] = func
  },

  addFormat: function(name, func) {
    this.fieldFormat[name] = func
  },

  addSchema: function(name, schema) {
    if (!schema && name) {
      schema = name
      name = undefined
    }
    if (schema.hasOwnProperty('id') && typeof schema.id === 'string' && schema.id !== name) {
      if (schema.id.charAt(0) === '/') { throw new Error('jjv: schema id\'s starting with / are invalid.') }
      this.schema[normalizeID(schema.id)] = schema
    } else if (!name) {
      throw new Error('jjv: schema needs either a name or id attribute.')
    }
    if (name) { this.schema[normalizeID(name)] = schema }
  }
}

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
      'enum': [ 'array', 'boolean', 'integer', 'null', 'number', 'object', 'string', 'function', 'schema', 'regex', 'objectId', 'date' ]
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
}

const isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/

const p_env = Symbol('env')
const p_errors = Symbol('errors')

module.exports = class Env {

  constructor() {

    this[p_errors] = null
    const env = this[p_env] = new Environment()

    env.addSchema('http://json-schema.org/draft-04/schema#', v4Schema)

    env.addType('function', function(fn) {
      return typeof fn === 'function'
    })
    env.addType('schema', function(schema) {
      return exports.validate(v4Schema, schema)
    })
    env.addType('regex', function(pattern) {
      let match
      return (typeof pattern === 'string') && pattern.length > 0 && (match = pattern.match(/^\/(.*)\/(.*)/)) && match[0].length > 0
    })
    env.addType('date', function(date) {
      return (fieldType.date(date) && !isNaN(date.getTime())) || ((typeof date === 'string') && isoRegex.test(date))
    })
    env.addType('objectId', function(id) {
      return couldBeId(id)
    })
  }

  validate(schema, json) {
    const errors = this[p_errors] = this[p_env].validate(schema, json)
    if (errors) {
      throw {code: 'script.invalidArgument.validation', message: 'schema validation failed', reason: JSON.stringify(errors)}
    }
  }

  get errors() {
    return this[p_errors]
  }

}
