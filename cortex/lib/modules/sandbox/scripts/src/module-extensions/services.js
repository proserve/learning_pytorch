
const {
        iface, endpoints, call, list, apiRun, apiList
      } = module.exports,
      { OpaqueStream } = require('stream'),
      { ApiCursor } = require('util.cursor'),
      pName = Symbol('pName')

function callService(name, method, path, options) {

  let result = call(name, method, path, options)
  if (result && result._id && result.object === 'stream') {
    result = new OpaqueStream(result)
  } else if (result && result._id && result.object === 'cursor') {
    result = new ApiCursor(result)
  }
  return result

}

class Service {

  constructor(name) {
    this[pName] = name
  }

  interface() {
    return iface(this[pName])
  }

  endpoints() {
    return endpoints(this[pName])
  }

  get(path, options) {
    return callService(this[pName], 'get', path, options)
  }

  head(path, options) {
    return callService(this[pName], 'head', path, options)
  }

  post(path, body, options) {
    return callService(this[pName], 'post', path, { body, ...options })
  }

  put(path, body, options) {
    return callService(this[pName], 'put', path, { body, ...options })
  }

  patch(path, body, options) {
    return callService(this[pName], 'patch', path, { body, ...options })
  }

  delete(path, options) {
    return callService(this[pName], 'delete', path, options)
  }

}

class ApiService extends Service {

  constructor() {
    super('api')
  }

  list() {
    return apiList()
  }

  run(...args) {
    return apiRun(...args)
  }

}

module.exports = Object.assign(new Proxy({}, {

  get(target, property) {
    if (!(property in target)) {
      target[property] = property === 'api' ? new ApiService() : new Service(property)
    }
    return target[property]
  }

}), {

  list,
  callService

})
