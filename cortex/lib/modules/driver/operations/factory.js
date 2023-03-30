'use strict'

const Fault = require('cortex-service/lib/fault'),
      modulePrivates = require('../../../classes/privates').createAccessor()

class Factory {

  constructor() {

    const privates = modulePrivates(this)

    privates.operations = new Map()

  }

  get names() {

    return Array.from(modulePrivates(this).operations.keys())
  }

  register(operationName, OperationClass) {

    modulePrivates(this).operations.set(operationName, OperationClass)

  }

  get(operationName) {

    return modulePrivates(this).operations.get(operationName)

  }

  create(driverInstance, operationName, options = {}) {

    const OperationClass = this.get(operationName)

    if (!OperationClass) {
      throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Unsupported db operation', path: operationName })
    }
    return new OperationClass(driverInstance, operationName, options)

  }

}

module.exports = new Factory()
