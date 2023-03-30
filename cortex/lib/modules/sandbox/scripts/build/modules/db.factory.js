'use strict';

var operations = new Map();

function register(operationName, OperationClass) {
  operations.set(operationName, OperationClass);
}

function get(operationName) {
  return operations.get(operationName);
}

function create(operationName, operationObject) {
  var OperationClass = get(operationName);
  if (!OperationClass) {
    throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Unsupported db operation', path: operationName });
  }
  return new OperationClass(operationObject);
}

module.exports = {
  register: register,
  get: get,
  create: create };