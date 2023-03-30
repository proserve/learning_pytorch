
const privatesAccessor = require('../../classes/privates').createAccessor(),
      Factory = require('./operations/factory'),
      { AccessContext } = require('../../acl'),
      {
        CursorOperation,
        CountOperation,
        BulkOperation,
        InsertOneOperation,
        InsertManyOperation,
        UpdateOneOperation,
        UpdateManyOperation,
        PatchOneOperation,
        PatchManyOperation,
        DeleteOneOperation,
        DeleteManyOperation,
        ReadOneOperation
      } = require('./operations')

class Driver {

  /**
   * @param principal calling principal
   * @param object the source object model
   * @param req http request or mock request object
   * @param script if present, allows extra options allowed with scripts, such as skipAcl, grant, allowedOptions, etc.
   */
  constructor(principal, object, { req, script } = {}) {

    Object.assign(privatesAccessor(this), {
      principal,
      req,
      script,
      object
    })

  }

  get principal() {
    return privatesAccessor(this).principal
  }

  get org() {
    const { principal: { org } = {} } = privatesAccessor(this)
    return org
  }

  get req() {
    return privatesAccessor(this).req
  }

  get script() {
    return privatesAccessor(this).script
  }

  get object() {
    return privatesAccessor(this).object
  }

  createAccessContext() {

    const { principal, object, req, script } = this
    return new AccessContext(principal, null, { object, req, script })

  }

  async bulk(userOptions, privilegedOptions, internalOptions) {

    const operation = new BulkOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async cursor(userOptions, privilegedOptions, internalOptions) {

    const operation = new CursorOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async count(userOptions, privilegedOptions, internalOptions) {

    const operation = new CountOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async readOne(userOptions, privilegedOptions, internalOptions) {

    const operation = new ReadOneOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async insertOne(userOptions, privilegedOptions, internalOptions) {

    const operation = new InsertOneOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async insertMany(userOptions, privilegedOptions, internalOptions) {

    const operation = new InsertManyOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async updateOne(userOptions, privilegedOptions, internalOptions) {

    const operation = new UpdateOneOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async updateMany(userOptions, privilegedOptions, internalOptions) {

    const operation = new UpdateManyOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async patchOne(userOptions, privilegedOptions, internalOptions) {

    const operation = new PatchOneOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async patchMany(userOptions, privilegedOptions, internalOptions) {

    const operation = new PatchManyOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async deleteOne(userOptions, privilegedOptions, internalOptions) {

    const operation = new DeleteOneOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  async deleteMany(userOptions, privilegedOptions, internalOptions) {

    const operation = new DeleteManyOperation(this)
    return operation.execute(userOptions, privilegedOptions, internalOptions)
  }

  // dynamic interface ---------------------------------------------

  createOperation(operationName, options = {}) {
    return Factory.create(this, operationName, options)
  }

  async executeOperation(operationName, userOptions, privilegedOptions, internalOptions) {

    const operation = this.createOperation(operationName, internalOptions)
    return {
      operation,
      result: await operation.execute(userOptions, privilegedOptions, internalOptions)
    }
  }

  static get operationNames() {

    return Factory.names
  }

}

module.exports = Driver
