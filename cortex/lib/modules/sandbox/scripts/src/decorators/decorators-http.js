const { decorate, isDescriptor } = require('decorator-utils'),
      pHttpOptions = Symbol('http_options')

function makeOptions(args) {
  let verbs = [],
      options = {}
  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === 'string') {
      (args[i] === '*') ? verbs.push('get', 'post', 'put', 'delete') : verbs.push(args[i].toLowerCase())
    } else {
      options = args[i]
      break
    }
  }
  return { verbs, options }
}

function handleMethod(cls, descriptor, handler, verbs, options) {
  cls[pHttpOptions] = cls[pHttpOptions] || {}
  cls[pHttpOptions][handler] = { verbs, options }
  return descriptor
}

function getPrefix(req) {
  const parts = req.path.split('/')
  parts[parts.length - 1] = '' // end up with a trailing slash.
  return parts.join('/')
}

function handleClass(Cls, verbs, options) {

  const req = require('request'),
        res = require('response')

  if (req && req.method) {

    const verb = req.method.toLowerCase()
    if (verbs.includes(verb)) {

      const prefix = String(options.prefix || getPrefix(req))

      options = { prefix, ...options }

      let handler = typeof Cls.prototype[options.default] === 'function' ? options.default : null,
          auth = null

      if (req.path.indexOf(prefix) === 0) {

        const h = req.path.substr(prefix.length).replace(/\/$/, ''),
              entry = (Cls[pHttpOptions] || {})[h]
        if (entry && entry.verbs.includes(verb)) {
          handler = h
          const headers = { ...options.headers, ...entry.options.headers }
          auth = { ...options.auth, ...entry.options.auth }
          Object.keys(headers).forEach((header) => res.setHeader(header, headers[header]))
        }
      }

      if (handler) {
        if (auth && Object.keys(auth).length) {
          const {
            username = '', password = '', realm = req.url, authorize = null
          } = auth
          basicAuth(req, res, username, password, realm, authorize)
        }
        const instance = new Cls(req, res, options)
        instance[handler](req, res, options)
      }
    }
  }
  return null
}

function handleDescriptor(ClassOrProto, HandlerOrArgs, descriptor, rest) {
  const cls = descriptor ? ClassOrProto.constructor : ClassOrProto,
        handler = descriptor ? HandlerOrArgs : null,
        { verbs, options } = makeOptions(descriptor ? rest : HandlerOrArgs)
  if (descriptor && typeof descriptor.value === 'function') {
    return handleMethod(cls, descriptor, handler, verbs, options)
  } if (!descriptor) {
    return handleClass(cls, verbs, options)
  }
  return descriptor
}

module.exports = function http(...args) {
  return decorate(handleDescriptor, isDescriptor(args[args.length - 1]) ? [] : args)
}

function basicAuth(req, res, username, password, realm, authorize) {

  const base64 = require('base64'),
        CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/,
        USER_PASS_REGEXP = /^([^:]*):(.*)$/,
        authorization = req.getHeader('authorization')
  if (authorization) {
    const credentialsMatch = CREDENTIALS_REGEXP.exec(authorization)
    if (credentialsMatch) {
      const usernamePasswordMatch = USER_PASS_REGEXP.exec(base64.decode(credentialsMatch[1]))
      if (usernamePasswordMatch) {
        let ok = true
        if (username) {
          if (typeof username === 'object') {
            ok = require('accounts').find({ $and: [username, { email: usernamePasswordMatch[1] }] }).limit(1).skipAcl()
              .grant(8)
              .paths('_id')
              .hasNext()
          } else {
            ok = usernamePasswordMatch[1] === username
          }
        }
        if (ok && password) {
          ok = usernamePasswordMatch[2] === password
        }
        if (ok && typeof authorize === 'function') {
          ok = authorize(req, res, usernamePasswordMatch[1], usernamePasswordMatch[2], realm)
        }
        if (ok) {
          return
        }
      }
    }
  }
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('WWW-Authenticate', `Basic realm="${realm}"`)
  res.setStatusCode(401)
  res.write('Authorization Required')
  throw new Error('Authorization Required')
}
