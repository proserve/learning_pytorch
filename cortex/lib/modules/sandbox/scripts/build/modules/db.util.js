'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}}var _require =

require('db.factory'),create = _require.create,_require2 =
require('lodash.core'),pick = _require2.pick;

function createOperation() {var userOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};var privilegedOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};var

  object = userOptions.object,operation = userOptions.operation,
  isCursor = operation === 'cursor',
  op = create(
  isCursor ? userOptions.pipeline ? 'aggregate' : 'find' : operation,
  object);


  return op.setOptions(userOptions, privilegedOptions);

}

function getAllowedOptions() {var userPool = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];var privilegedPool = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];var userOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};var privilegedOptions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};var _script =

  script,privileged = _script.principal.privileged;

  return _extends({},
  pick.apply(undefined, [userOptions].concat(_toConsumableArray(userPool))),
  pick.apply(undefined, [privileged ? _extends({}, userOptions, privilegedOptions) : privilegedOptions].concat(_toConsumableArray(privilegedPool))));

}exports.


createOperation = createOperation;exports.
getAllowedOptions = getAllowedOptions;