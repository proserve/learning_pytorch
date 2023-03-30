'use strict';var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _require =

require('decorator-utils'),decorate = _require.decorate,_require2 =
require('util.values'),toArray = _require2.array,isSet = _require2.isSet,_require3 =
require('util.id'),equalIds = _require3.equalIds,
targets = {
  logger: {
    levels: new Set(['warn', 'error', 'info', 'debug', 'trace']),
    module: function module() {return require('logger');} },

  console: {
    levels: new Set(['warn', 'error', 'info']),
    module: function module() {return console;} } };



function log() {

  var lineNumber = script.getCurrentLineNumber(-3);for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}

  return decorate(
  function (Class, methodName, descriptor, options) {

    var fn = descriptor.value,
    className = Class.name || Class.constructor.name,_ref =









    options[0] || {},_ref$environment = _ref.environment,environment = _ref$environment === undefined ? '*' : _ref$environment,_ref$target = _ref.target,target = _ref$target === undefined ? 'console' : _ref$target,_ref$roles = _ref.roles,roles = _ref$roles === undefined ? ['*'] : _ref$roles,_ref$level = _ref.level,level = _ref$level === undefined ? 'info' : _ref$level,_ref$traceError = _ref.traceError,traceError = _ref$traceError === undefined ? false : _ref$traceError,_ref$traceOnlyErrors = _ref.traceOnlyErrors,traceOnlyErrors = _ref$traceOnlyErrors === undefined ? false : _ref$traceOnlyErrors,_ref$traceResult = _ref.traceResult,traceResult = _ref$traceResult === undefined ? false : _ref$traceResult,_ref$format = _ref.format,format = _ref$format === undefined ? null : _ref$format,
    acceptRoles = toArray(roles, isSet(roles)),
    anyRole = acceptRoles.includes('*'),
    isTargetFunction = typeof target === 'function';

    if (typeof fn !== 'function') {
      throw new TypeError('@log can only be used on class functions');
    }

    if (!['*', script.env.name].includes(environment)) {
      return descriptor;
    }if (!isTargetFunction && (!targets[target] || targets[target].level)) {
      return descriptor;
    }

    return _extends({},
    descriptor, {
      value: function value() {for (var _len2 = arguments.length, params = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {params[_key2] = arguments[_key2];}


        if (
        !['*', script.env.name].includes(environment) ||
        !isTargetFunction && (!targets[target] || targets[target].level) ||
        !(anyRole || acceptRoles.find(function (accepted) {return script.principal.roles.find(function (id) {return equalIds(id, accepted) || equalIds(consts.roles[accepted], id);});}))) {
          return fn.call.apply(fn, [this].concat(params));
        }

        var err = void 0,
        logged = false,
        result = void 0;

        var start = performance.now(),
        log = {
          className: className,
          methodName: methodName,
          lineNumber: lineNumber },

        post = function post() {

          if (logged) {
            return;
          }

          logged = true;

          if (traceOnlyErrors && !err) {
            return;
          }

          log.ms = performance.now() - start;
          if (err && traceError) {
            log.err = err.toJSON();
          }
          if (!err && traceResult) {
            log.result = result;
          }

          try {
            var input = typeof format === 'function' ? format(log) : log;
            if (isTargetFunction) {
              target.apply(undefined, [input, level].concat(params));
            } else {
              targets[target].module()[level](input);
            }
          } catch (err) {
            void err;
          }

        };

        script.on('exit', post);

        try {
          result = fn.call.apply(fn, [this].concat(params));
        } catch (e) {
          err = e;
        }

        script.removeListener('exit', post);
        post();

        if (err) {
          throw err;
        }
        return result;

      } });


  },
  args);

}

module.exports = log;