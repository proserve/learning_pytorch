/* global cortexify, ObjectID, consts, script */

const objects = require('objects'),
      clone = require('clone'),
      { BulkOperation, Driver } = require('db'),
      { singularize, pluralize } = require('inflection'),
      pathTo = require('util.paths.to'),
      ids = require('util.id'),
      values = require('util.values'),
      runtimes = {
        transform: require('runtime.transform').Runtime,
        object: require('runtime.object').Runtime,
        route: require('runtime.route').Runtime,
        policy: require('runtime.policy').Runtime,
        trigger: require('runtime.trigger').Runtime,
        job: require('runtime.job').Runtime,
        event: require('runtime.event').Runtime
      },
      hasOwn = Object.prototype.hasOwnProperty,
      { toString } = Object.prototype,
      pObjects = Symbol('objects'),
      pLoaded = Symbol('loaded'),
      pScripts = Symbol('scripts'),
      registeredAliases = {},
      registeredObjects = {}

let Undefined,
    theEventLoop = null,
    scriptIsRunning = false,
    faultCodes,
    Org,
    faultErrCodeLookup,
    faultCodeLookup

function isPlainObject(obj) {

  if (!obj || toString.call(obj) !== '[object Object]') {
    return false
  }

  const hasOwnConstructor = hasOwn.call(obj, 'constructor'),
        hasIsPropertyOfMethod = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf')

  // Not own constructor property must be Object
  if (obj.constructor && !hasOwnConstructor && !hasIsPropertyOfMethod) {
    return false
  }

  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.
  let key
  for (key in obj) {}
  return key === Undefined || hasOwn.call(obj, key)

}

// pre-load commonly used modules.
require('util.deep-extend')

function freezeAndSeal(obj) {
  Object.freeze(obj)
  Object.seal(obj)
}

function setAndSeal(obj, name, value) {
  Object.defineProperty(obj, name, {
    value,
    enumerable: false
  })
  freezeAndSeal(obj[name])
}

function createNamedClass(singular, parentClass, constructor) {

  singular = String(singular).toLowerCase()

  if (singular === 'export') singular = '_export' // this hack allows reserved keywords to be used. the api strips leading underscores

  // eslint-disable-next-line no-new-func
  const Cls = Function('parentClass', 'constructor', `
        return function ${singular}(context) {                 
            parentClass.call(this, context); 
            if (typeof constructor === 'function') {
                constructor.call(this);
            }
        }`)(parentClass, constructor)

  Object.setPrototypeOf(Cls, parentClass)
  Object.setPrototypeOf(Cls.prototype, parentClass.prototype)

  try {
    Object.defineProperty(
      Cls,
      'objectName',
      {
        value: singular,
        enumerable: true,
        configurable: false
      }
    )
  } catch (err) {
    void err
  }

  cortexify(Cls) // augment with remote api

  return Cls

}

// polyfills -----------------------------------------------------------------------------------------------------------

if (global.performance === Undefined) {
  const performanceNow = new Date()
  setAndSeal(global, 'performance', {
    now: () => Date.now() - performanceNow
  })
}

// ---------------------------------------------------------------------------------------------------------------------

class CortexObject {

  /**
     * @param context {_id, object, ...properties}
     * @returns {*}
     */
  constructor(context) {

    context = this.constructor.normalize_context(context)

    Object.defineProperty(this, 'object', {
      value: this.constructor.getObjectName(),
      enumerable: true
    })

    // for json serializing, context properties must be enumerable. however, the sandbox will not allow
    // getter during serialization in order to protect the sandbox from pernicious user code that runs after
    // the sandbox thinks it's done running.
    for (const property in context) {
      if (context.hasOwnProperty(property)) {
        if (this[property] === Undefined) { // do not allow local properties to be overwritten.
          let value = context[property]
          if (property === '_id' && !(value instanceof ObjectID)) {
            value = new ObjectID(value)
          }
          Object.defineProperty(this, property, {
            value,
            enumerable: true
          })
        }
      }
    }
    if (this._id === Undefined) {
      Object.defineProperty(this, '_id', {
        value: null,
        enumerable: true
      })
    }
  }

  static forgetObject(name) {

    name = String(name).toLowerCase()

    const singular = singularize(name),
          plural = pluralize(name)

    delete registeredAliases[singular]
    delete registeredAliases[plural]
    delete registeredObjects[singular]

    if (global.script && global.script.org) {
      delete global.script.org[pObjects][name]
    }

  }

  static registerObject(name, cls, ...aliases) {
    [name, ...aliases].map((n) => n.toLowerCase()).forEach((alias) => {
      registeredAliases[alias] = name
    })
    registeredObjects[name] = cls
  }

  // eslint-disable-next-line camelcase
  static register_object(...args) {
    this.registerObject(...args)
  }

  static normalizeContext(context) {

    const name = this.getObjectName()

    if (context && context instanceof ObjectID) {
      context = {
        _id: context,
        object: name
      }
    } else if (typeof context === 'string') {
      if (this.name === 'CortexObject') {
        context = {
          object: context
        }
      } else {
        context = {
          _id: new ObjectID(context)
        }
      }
    } else if (!context) {
      context = {
        object: name
      }
    } else if (!context.object || (String(context.object).toLowerCase() !== name && this.name !== 'CortexObject')) {
      context = clone(context)
      context.object = name
    }
    return context
  }

  // eslint-disable-next-line camelcase
  static normalize_context(context) {
    return this.normalizeContext(context)
  }

  static from(context) {
    context = this.normalize_context(context)
    return new (this.as(context.object))(context)
  }

  /**
     * Create a CortexObject class from a name.
     * @param name
     * @returns {*}
     */
  static as(name) {

    name = String(name).toLowerCase()

    let singular = singularize(name),
        plural = pluralize(name),
        regName,
        cls

    if (name !== singular && name !== plural) {
      singular = plural = name
    }

    regName = registeredAliases[singular]

    if (regName) {
      return registeredObjects[regName]
    }

    // Using this allows subclassing of CortexObject
    // eg. HubObject.as('Namespace')

    cls = createNamedClass(singular, this)
    this.register_object(singular, cls, plural)

    return cls

  }

  static getObjectName() {
    return this.objectName || this.name.toLowerCase()
  }

  // driver interface -----------------------------------------------------------------------------------------------

  static setOwner(id, to) {
    return objects.transfer(this.getObjectName(), id, to)
  }

  static getAccessContext(path, options = {}) {
    return objects.getAccessContext(this.getObjectName(), path, options)
  }

  static through(prefix) {
    return new Driver(this.getObjectName()).through(prefix)
  }

  static aggregate(pipeline = []) {
    return new Driver(this.getObjectName()).aggregate(pipeline)
  }

  static count(where) {
    return new Driver(this.getObjectName()).count(where)
  }

  static deleteMany(match) {
    return new Driver(this.getObjectName()).deleteMany(match)
  }

  static deleteOne(match) {
    return new Driver(this.getObjectName()).deleteOne(match)
  }

  static find(where) {
    return new Driver(this.getObjectName()).find(where)
  }

  static readOne(where) {
    return new Driver(this.getObjectName()).readOne(where)
  }

  static insertMany(docs) {
    return new Driver(this.getObjectName()).insertMany(docs)
  }

  static insertOne(doc) {
    return new Driver(this.getObjectName()).insertOne(doc)
  }

  static updateOne(match, doc) {
    return new Driver(this.getObjectName()).updateOne(match, doc)
  }

  static updateMany(match, doc) {
    return new Driver(this.getObjectName()).updateMany(match, doc)
  }

  static patchOne(match, doc) {
    return new Driver(this.getObjectName()).patchOne(match, doc)
  }

  static patchMany(match, doc) {
    return new Driver(this.getObjectName()).patchMany(match, doc)
  }

  // ORM instance ----------------------------------------------------------------------------------------------------

  read(path, options) {
    if (typeof path !== 'string') {
      options = path
      path = null
    }
    return objects.read(this.object, this._id + (path ? `.${path}` : ''), options)
  }

  delete(path, options) {
    if (typeof path !== 'string') {
      options = path
      path = null
    }
    return objects.delete(this.object, this._id + (path ? `.${path}` : ''), options)
  }

  update(path, body, options) {
    if (typeof path !== 'string') {
      options = body
      body = path
      path = null
    }
    return objects.update(this.object, this._id + (path ? `.${path}` : ''), body, options)
  }

  patch(ops, options) {
    return objects.patch(this.object, this._id, ops, options)
  }

  push(path, body, options) {
    if (typeof path !== 'string') {
      options = body
      body = path
      path = null
    }
    return objects.push(this.object, this._id + (path ? `.${path}` : ''), body, options)
  }

  setOwner(to) {
    return objects.transfer(this.object, this._id, to)
  }

}
setAndSeal(global, 'CortexObject', CortexObject)

// ---------------------------------------------------------------------------------------------------------------------

Org = createNamedClass('org', CortexObject, function() {
  this[pLoaded] = {
    bulk(name = null) {
      return new BulkOperation(name)
    }
  }
  this[pObjects] = new Proxy(this[pLoaded], {
    get(target, property) {

      const name = String(singularize(property)).toLowerCase().trim()

      if (name in target) {
        return target[name]
      }

      let object = runtimes.object.getObjectClass(name)
      if (!object) {
        object = CortexObject.as(name)
      }
      target[name] = object

      return object
    }
  })
  this[pScripts] = new Proxy({}, {
    get(target, name) {
      let err = null
      if (name.indexOf('c_') !== 0 && !~name.indexOf('__')) {
        err = new Error('Resource not found')
        err.errCode = 'script.notFound.unspecified'
        err.reason = `library script (${name}) not found.`
      }
      if (err) throw err; else return require(name) // keep line traces the same
    }
  })

})
Object.defineProperties(Org.prototype, {
  objects: {
    get() {
      return this[pObjects]
    }
  },
  scripts: {
    get() {
      return this[pScripts]
    }
  }
})
CortexObject.register_object('org', Org, 'orgs')
freezeAndSeal(Org)

Object.assign(CortexObject.as('Account').prototype, {
  hasRole(role) {
    const roleId = ids.couldBeId(role) ? role : consts.roles[role]
    return ids.inIdArray(values.array(this.roles), roleId)
  },
  isAnonymous() {
    return ids.equalIds(this._id, consts.principals.anonymous)
  },
  isPublic() {
    return ids.equalIds(this._id, consts.principals.public)
  },
  isAuthenticated() {
    return !(ids.equalIds(this._id, consts.principals.anonymous) || ids.equalIds(this._id, consts.principals.public))
  },
  isOrgAdmin() {
    return this.hasRole(consts.roles.Administrator)
  },
  isDeveloper() {
    return this.hasRole(consts.roles.Developer)
  },
  isSupport() {
    return this.hasRole(consts.roles.Support)
  }
})

// ---------------------------------------------------------------------------------------------------------------------

Error.create = function(obj) {
  const err = new Error(obj.message || '')
  if (obj.code) err.code = obj.code
  if (obj.name) err.name = obj.name
  if (obj.statusCode) err.statusCode = obj.statusCode || obj.status
  return err

}

Object.assign(Error.prototype, {

  object: 'fault',
  code: 'kError',
  name: 'error',
  errCode: 'script.error.unspecified',
  statusCode: 500,

  toJSON() {

    const json = {
      object: 'fault',
      name: this.name || 'error',
      errCode: this.errCode || 'script.error.unspecified',
      code: this.code || 'kError',
      message: this.getMessage(),
      status: this.statusCode || this.status,
      trace: this.trace,
      path: this.path,
      reason: this.reason
    }

    if (this.faults && this.faults.length) {
      json.faults = []
      this.faults.forEach((f) => {
        json.faults.push(global.Fault.from(f, true).toJSON())
      })
    }

    if (typeof this.index === 'number' && this.index >= 0) {
      json.index = this.index
    }

    return json
  },

  add(obj) {
    const err = (obj instanceof Error) ? obj : Error.create(obj);
    (this.faults || (this.faults = [])).push(err)
  },

  getMessage() {
    return ((typeof this.message === 'string') ? this.message : '')
  }

})

faultCodes = {
  kInvalidArgument: ['script.invalidArgument.unspecified', 'error', 400, 'Invalid Argument'],
  kValidationError: ['script.invalidArgument.validation', 'validation', 400, 'Validation error'],
  kAccessDenied: ['script.accessDenied.unspecified', 'error', 403, 'Access to this resource is denied'],
  kNotFound: ['script.notFound.unspecified', 'error', 404, 'Resource not found'],
  kTimeout: ['script.timeout.unspecified', 'error', 408, 'Timeout'],
  kExists: ['script.conflict.exists', 'error', 409, 'Resource already exists'],
  kExpired: ['script.expired.unspecified', 'error', 410, 'Resource expired.'],
  kRequestTooLarge: ['script.tooLarge.unspecified', 'error', 413, 'Request too large'],
  kThrottled: ['script.throttled.unspecified', 'error', 429, 'Request throttled'],
  kTooBusy: ['script.tooBusy.unspecified', 'error', 429, 'Server too busy'],
  kError: ['script.error.unspecified', 'error', 500, 'Error'],
  kNotImplemented: ['script.notImplemented.unspecified', 'error', 501, 'Not implemented'],
  kUnsupportedOperation: ['script.unsupportedOperation.unspecified', 'error', 501, 'Unsupported Operation']
}

faultErrCodeLookup = {
  kInvalidArgument: 'invalidArgument',
  kValidationError: 'validation',
  kAccessDenied: 'accessDenied',
  kNotFound: 'notFound',
  kTimeout: 'timeout',
  kExists: 'conflict',
  kExpired: 'expired',
  kRequestTooLarge: 'tooLarge',
  kThrottled: 'throttled',
  kTooBusy: 'tooBusy',
  kError: 'error',
  kNotImplemented: 'notImplemented',
  kUnsupportedOperation: 'unsupportedOperation'
}

faultCodeLookup = {
  invalidArgument: 'kInvalidArgument',
  validation: 'kValidationError',
  accessDenied: 'kAccessDenied',
  notFound: 'kNotFound',
  timeout: 'kTimeout',
  conflict: 'kExists',
  expired: 'kExpired',
  tooLarge: 'kRequestTooLarge',
  throttled: 'kThrottled',
  tooBusy: 'kTooBusy',
  error: 'kError',
  notImplemented: 'kNotImplemented',
  unsupportedOperation: 'kUnsupportedOperation'
}

global.Fault = class Fault extends Error {

  constructor(code, message, statusCode, name, reason, path, index, resource) {

    const obj = Fault.normalizeOptions(code, message, statusCode, name, reason, path, [], index, resource)

    super(obj.code)

    this.faults = []

    this.errCode = obj.errCode
    this.code = obj.code
    this.statusCode = obj.statusCode
    this.name = obj.name
    this.message = obj.message
    this.reason = obj.reason
    this.path = obj.path
    this.resource = obj.resource
    this.index = obj.index

    if (Array.isArray(obj.faults)) {
      for (let f = 0; f < obj.faults.length; f++) {
        const child = Fault.from(obj.faults[f])
        if (child) this.add(child)
      }
    }

  }

  toString() {
    return `${this.name} ${this.code}${((typeof this.message === 'string') && (this.message.length > 0)) ? (`: ${this.message}`) : ''}`
  }

  add(errOrCode, msg) {
    this.faults.push((errOrCode instanceof Error) ? errOrCode : Fault.create(errOrCode, msg))
  }

  getMessage() {
    if (typeof this.message === 'string' && (this.message.length > 0)) {
      return this.message
    }
    return Fault.lookupMessage(this.code)
  }

  static isErrCode(code) {
    return typeof code === 'string' && code.indexOf('.') !== -1
  }

  static errCodeToCode(errCode) {
    if (Fault.isErrCode(errCode)) {
      const [, code] = errCode.split('.')
      return faultCodeLookup[code] || 'kError'
    }
    return 'kError'
  }

  static codeToErrCode(code = 'kError', ns = 'script', detail = 'unspecified') {
    return [ns, faultErrCodeLookup[code] || 'error', detail].join('.')
  }

  static normalizeOptions(code, msg, statusCode, name, reason, path, faults, index, resource) {

    let obj,
        errCode,
        item

    if (values.isError(code)) {
      code = { ...code.toJSON() }
    }
    if (isPlainObject(code)) {
      obj = { ...code }
    } else {
      if (Fault.isErrCode(code)) {
        errCode = code
        code = Fault.errCodeToCode(errCode)
      } else {
        errCode = Fault.codeToErrCode(code)
      }
      if (isPlainObject(msg)) {
        obj = { errCode, code, ...msg }
      } else {
        obj = {
          errCode, code, msg, statusCode, name, reason, path, resource, index, faults
        }
      }
    }

    item = Fault.findRegisteredError(obj.code)

    obj.errCode = obj.errCode || (Fault.isErrCode(obj.code) ? obj.code : Fault.codeToErrCode(obj.code))
    obj.code = obj.code || Fault.errCodeToCode(obj.errCode)
    obj.message = values.rString(obj.msg || obj.message, Fault.lookupMessage(obj.code))
    obj.statusCode = obj.statusCode || obj.status || Fault.lookupStatusCode(obj.code) || 500
    obj.name = obj.name || (item ? item[1] : 'fault')

    return obj

  }

  static from(err, forceError) {

    // already a fault of non-convertible?
    if (err instanceof Fault) {
      return err
    }

    const isObject = isPlainObject(err)

    // detect a plain object that is a fault (perhaps a return value from a remote call).
    if (isObject && !(err instanceof Error)) {
      if (pathTo(err, 'object') === 'fault') {
        return Fault.create(err)
      }
    }

    if (err instanceof Error) {
      return new Fault('kError', err.message, err.statusCode || err.status, err.name || 'error', err.path, err.index, err.resource)
    }

    if (forceError) {
      const errCode = values.rString(isObject ? err.code : 'kError', 'kError')
      return Fault.create(errCode, err)
    }

    return null

  }

  static create(code, msg, statusCode, name, reason, path, faults, index, resource) {

    return new Fault(
      Fault.normalizeOptions(code, msg, statusCode, name, reason, path, faults, index, resource)
    )

  }

  static validationError(code, msg, statusCode, name, reason, path, index, resource) {
    const valErr = Fault.create('cortex.invalidArgument.validation')
    valErr.index = index
    valErr.add(Fault.create(code, msg, statusCode, name, reason, path, index, resource))
    return valErr
  }

  static addCode(code, name = 'error', statusCode = 500, message = 'Error', errCode = 'script.error.unspecified') {
    faultCodes[code] = [errCode, name, statusCode, message]
  }

  static lookupStatusCode(code) {
    const v = faultCodes[code]
    return v ? v[2] : 500
  }

  static lookupMessage(code) {
    const v = faultCodes[code]
    return v ? v[3] : ''
  }

  static isFault(fault) {
    return fault && (fault instanceof Fault)
  }

  static findRegisteredError(code) {
    return faultCodes[code]
  }

}

// Event Loop ----------------------------------------------------------------------------------------------------------

class EventLoop {

  constructor() {
    this.timers = []
    this.expiring = null
    this.nextTimerId = 1
    this.minimumDelay = 1
    this.minimumWait = 1
    this.maximumWait = 60000
    this.maxExpirys = 10
  }

  getEarliestTimer() {
    const { timers } = this,
          n = timers.length
    return (n > 0 ? timers[n - 1] : null)
  }

  getEarliestWait() {
    const t = this.getEarliestTimer()
    return (t ? t.target - Date.now() : null)
  }

  insertTimer(timer) {
    const { timers } = this,
          n = timers.length
    let i
    for (i = n - 1; i >= 0; i--) {
      const t = timers[i]
      if (timer.target <= t.target) {
        break
      }
    }
    timers.splice(i + 1 /* start */, 0 /* deleteCount */, timer)
  }

  removeTimerById(timerId) {
    const { timers } = this,
          n = timers.length
    let i,
        t = this.expiring

    if (t) {
      if (t.id === timerId) {
        t.removed = true
        return
      }
    }
    for (i = 0; i < n; i++) {
      t = timers[i]
      if (t.id === timerId) {
        t.removed = true
        this.timers.splice(i /* start */, 1 /* deleteCount */)
        return
      }
    }
  }

  processTimers() {
    const now = Date.now(),
          { timers } = this

    let sanity = this.maxExpirys,
        n,
        t

    while (sanity-- > 0) {
      if (script.exited) {
        break
      }

      n = timers.length
      if (n <= 0) {
        break
      }
      t = timers[n - 1]
      if (now <= t.target) {
        break
      }
      timers.pop()

      if (t.oneshot) {
        t.removed = true
      } else {
        t.target = now + t.delay
      }
      this.expiring = t
      t.cb()
      this.expiring = null

      if (!t.removed) {
        this.insertTimer(t)
      }
    }
  }

  run() {
    for (;;) {
      this.processTimers()
      if (script.exited) {
        break
      }
      let wait = this.getEarliestWait()
      if (wait === null) {
        break
      } else {
        wait = Math.min(this.maximumWait, Math.max(this.minimumWait, wait))
        require('timers').sleep(wait)
      }
    }
  }

}

function eventLoop() {
  return theEventLoop || (theEventLoop = new EventLoop())
}

function setImmediate(func, ...args) {
  return setTimeout(func, 0, ...args)
}

function clearImmediate(id) {
  return clearTimeout(id)
}

function setTimeout(func, delay) {
  let cb,
      args,
      id,
      loop = eventLoop()
  if (typeof delay !== 'number') {
    if (typeof delay === 'undefined') {
      delay = 0
    } else {
      throw new TypeError('invalid delay')
    }
  }
  delay = Math.max(loop.minimumDelay, delay)
  if (typeof func !== 'function') {
    throw new TypeError('callback is not a function/string')
  } else if (arguments.length > 2) {
    args = Array.prototype.slice.call(arguments, 2)
    args.unshift(this) // [ global(this), arg1, arg2, ... ]
    cb = func.bind.apply(func, args)
  } else {
    // Normal case: callback given as a function without arguments.
    cb = func
  }
  id = loop.nextTimerId++
  loop.insertTimer({
    id,
    oneshot: true,
    cb,
    delay,
    target: Date.now() + delay
  })
  return id
}

function clearTimeout(id) {
  if (typeof id !== 'number') {
    throw new TypeError('timer ID is not a number')
  }
  eventLoop().removeTimerById(id)
}

function setInterval(func, delay) {
  let cb,
      args,
      timerId,
      loop = eventLoop()
  if (typeof delay !== 'number') {
    if (typeof delay === 'undefined') {
      delay = 0
    } else {
      throw new TypeError('invalid delay')
    }
  }
  delay = Math.max(loop.minimumDelay, delay)
  if (typeof func !== 'function') {
    throw new TypeError('callback is not a function/string')
  } else if (arguments.length > 2) {
    // Special case: callback arguments are provided.
    args = Array.prototype.slice.call(arguments, 2) // [ arg1, arg2, ... ]
    args.unshift(this) // [ global(this), arg1, arg2, ... ]
    cb = func.bind.apply(func, args)
  } else {
    cb = func
  }
  timerId = loop.nextTimerId++
  loop.insertTimer({
    id: timerId,
    oneshot: false,
    cb,
    delay,
    target: Date.now() + delay
  })
  return timerId
}

function clearInterval(id) {
  if (typeof id !== 'number') {
    throw new TypeError('timer ID is not a number')
  }
  eventLoop().removeTimerById(id)
}

setAndSeal(global, 'main', (main, { runtime = {} } = {}) => {
  if (!scriptIsRunning) {

    scriptIsRunning = true

    let mainResult

    const { type } = runtime

    if (type) {

      const module = { exports: {} }
      mainResult = runtimes[type].run(require, module.exports, module, main, runtime)

    } else {
      mainResult = main()
    }

    eventLoop().run()
    script.exit(mainResult)
  }
})

setAndSeal(global, 'setImmediate', setImmediate)
setAndSeal(global, 'setTimeout', setTimeout)
setAndSeal(global, 'setInterval', setInterval)
setAndSeal(global, 'clearImmediate', clearImmediate)
setAndSeal(global, 'clearTimeout', clearTimeout)
setAndSeal(global, 'clearInterval', clearInterval)

/**
 * auto-globals
 */
Object.defineProperties(global, {
  __LINE__: {
    get() {
      return script.getCurrentLineNumber(-3)
    }
  },
  process: {
    get() {
      return require('process')
    }
  },
  org: {
    get() {
      return global.script.org
    }
  },
  consts: {
    get() {
      return require('consts')
    }
  },
  console: {
    get() {
      return require('console')
    }
  },
  script: {
    get() {
      return require('script')
    }
  },
  services: {
    get() {
      return require('services')
    }
  },
  sys: {
    get() {
      return require('system')
    }
  },
  Intl: {
    get() {
      return require('intl')
    }
  }

})

;['Map', 'WeakMap', 'Set', 'WeakSet', 'Symbol', 'regeneratorRuntime'].forEach((name) => {
  setAndSeal(global, name, global[name])
})

Buffer.from = function(buf, enc) {
  return (enc) ? new Buffer(buf, enc) : new Buffer(buf)
}

Buffer.alloc = function(n) {
  return new Buffer(n)
}

Buffer.allocUnsafe = function(n) {
  return new Buffer(n)
}

;[Object, ObjectID, ObjectID.prototype, Buffer, Buffer.prototype].forEach((obj) => {
  freezeAndSeal(obj)
})

freezeAndSeal(global)
