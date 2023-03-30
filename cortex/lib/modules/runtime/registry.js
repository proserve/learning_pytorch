const Loki = require('lokijs'),
      privatesAccessor = require('../../classes/privates').createAccessor(),
      logger = require('cortex-service/lib/logger')

/**
 * A registry for running operations.
 *
 * @emits register - emitted when an operation is registered.
 * @emits unregister - emitted when an operation is unregistered.
 */
class OperationRegistry {

  constructor() {

    const db = new Loki('operations.db'),
          operations = db.addCollection('operations')

    operations.ensureIndex('uuid')
    operations.ensureIndex('_id')
    operations.ensureIndex('env')
    operations.ensureIndex('envId')
    operations.ensureIndex('type')

    Object.assign(privatesAccessor(this), {
      db,
      operations
    })

  }

  register(operation) {

    const privates = privatesAccessor(this),
          { operations } = privates

    operations.insert({
      ...operation._getInsertDocument(),
      $operation: operation
    })

  }

  unregister(operation) {

    const { operations } = privatesAccessor(this),
          { uuid } = operation,
          doc = operations.findOne({ uuid })

    if (doc) {
      if (operation.active) {
        logger.warn(`removed active operation: ${operation.context}`)
      }
      try {
        operations.remove(doc)
      } catch (err) {
        void err
      }
    } else {
      logger.warn(`operation not found in registry: ${operation.context}`)
    }

    return !!doc

  }

  find(filter = {}) {

    const { operations } = privatesAccessor(this)
    return operations.find(filter).map(doc => doc.$operation)

  }

  findOne(filter = {}) {

    const { operations } = privatesAccessor(this),
          doc = operations.findOne(filter)

    return doc ? doc.$operation : null

  }

  count(filter = {}) {

    const { operations } = privatesAccessor(this)
    return operations.find(filter).length
  }

  where(fn) {
    const { operations } = privatesAccessor(this)
    return operations.where(fn)
  }

}

module.exports = new OperationRegistry()
