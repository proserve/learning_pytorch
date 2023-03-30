'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _require = require('decorator-utils'),decorate = _require.decorate,isDescriptor = _require.isDescriptor,
pHttpOptions = Symbol('http_options');

function makeOptions(args) {
  var verbs = [],
  options = {};
  for (var i = 0; i < args.length; i++) {
    if (typeof args[i] === 'string') {
      args[i] === '*' ? verbs.push('get', 'post', 'put', 'delete') : verbs.push(args[i].toLowerCase());
    } else {
      options = args[i];
      break;
    }
  }
  return { verbs: verbs, options: options };
}

function handleMethod(cls, descriptor, handler, verbs, options) {
  cls[pHttpOptions] = cls[pHttpOptions] || {};
  cls[pHttpOptions][handler] = { verbs: verbs, options: options };
  return descriptor;
}

function getPrefix(req) {
  var parts = req.path.split('/');
  parts[parts.length - 1] = '';
  return parts.join('/');
}

function handleClass(Cls, verbs, options) {

  var req = require('request'),
  res = require('response');

  if (req && req.method) {

    var verb = req.method.toLowerCase();
    if (verbs.includes(verb)) {

      var prefix = String(options.prefix || getPrefix(req));

      options = _extends({ prefix: prefix }, options);

      var handler = typeof Cls.prototype[options.default] === 'function' ? options.default : null,
      auth = null;

      if (req.path.indexOf(prefix) === 0) {

        var h = req.path.substr(prefix.length).replace(/\/$/, ''),
        entry = (Cls[pHttpOptions] || {})[h];
        if (entry && entry.verbs.includes(verb)) {
          handler = h;
          var headers = _extends({}, options.headers, entry.options.headers);
          auth = _extends({}, options.auth, entry.options.auth);
          Object.keys(headers).forEach(function (header) {return res.setHeader(header, headers[header]);});
        }
      }

      if (handler) {
        if (auth && Object.keys(auth).length) {var _auth =


          auth,_auth$username = _auth.username,username = _auth$username === undefined ? '' : _auth$username,_auth$password = _auth.password,password = _auth$password === undefined ? '' : _auth$password,_auth$realm = _auth.realm,realm = _auth$realm === undefined ? req.url : _auth$realm,_auth$authorize = _auth.authorize,authorize = _auth$authorize === undefined ? null : _auth$authorize;
          basicAuth(req, res, username, password, realm, authorize);
        }
        var instance = new Cls(req, res, options);
        instance[handler](req, res, options);
      }
    }
  }
  return null;
}

function handleDescriptor(ClassOrProto, HandlerOrArgs, descriptor, rest) {
  var cls = descriptor ? ClassOrProto.constructor : ClassOrProto,
  handler = descriptor ? HandlerOrArgs : null,_makeOptions =
  makeOptions(descriptor ? rest : HandlerOrArgs),verbs = _makeOptions.verbs,options = _makeOptions.options;
  if (descriptor && typeof descriptor.value === 'function') {
    return handleMethod(cls, descriptor, handler, verbs, options);
  }if (!descriptor) {
    return handleClass(cls, verbs, options);
  }
  return descriptor;
}

module.exports = function http() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
  return decorate(handleDescriptor, isDescriptor(args[args.length - 1]) ? [] : args);
};

function basicAuth(req, res, username, password, realm, authorize) {

  var base64 = require('base64'),
  CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/,
  USER_PASS_REGEXP = /^([^:]*):(.*)$/,
  authorization = req.getHeader('authorization');
  if (authorization) {
    var credentialsMatch = CREDENTIALS_REGEXP.exec(authorization);
    if (credentialsMatch) {
      var usernamePasswordMatch = USER_PASS_REGEXP.exec(base64.decode(credentialsMatch[1]));
      if (usernamePasswordMatch) {
        var ok = true;
        if (username) {
          if ((typeof username === 'undefined' ? 'undefined' : _typeof(username)) === 'object') {
            ok = require('accounts').find({ $and: [username, { email: usernamePasswordMatch[1] }] }).limit(1).skipAcl().
            grant(8).
            paths('_id').
            hasNext();
          } else {
            ok = usernamePasswordMatch[1] === username;
          }
        }
        if (ok && password) {
          ok = usernamePasswordMatch[2] === password;
        }
        if (ok && typeof authorize === 'function') {
          ok = authorize(req, res, usernamePasswordMatch[1], usernamePasswordMatch[2], realm);
        }
        if (ok) {
          return;
        }
      }
    }
  }
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('WWW-Authenticate', 'Basic realm="' + realm + '"');
  res.setStatusCode(401);
  res.write('Authorization Required');
  throw new Error('Authorization Required');
}