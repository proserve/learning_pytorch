import { QueryCursor, AggregationCursor } from 'db.cursor'
import {
  ReadOneOperation,
  InsertOperation,
  InsertManyOperation,
  UpdateOperation,
  UpdateManyOperation,
  DeleteOperation,
  DeleteManyOperation,
  PatchOperation,
  PatchManyOperation,
  CountOperation
} from 'db.operation'

const pObjectName = Symbol('objectName'),
      pThrough = Symbol('through')

class Driver {

  constructor(objectName) {
    this[pObjectName] = objectName
  }

  through(through) {
    this[pThrough] = through
    return this
  }

  aggregate(pipeline = []) {
    if (!Array.isArray(pipeline)) {
      throw new TypeError('aggregate expects array pipeline')
    }
    const v = new AggregationCursor(this[pObjectName], pipeline)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  count(where) {
    const v = new CountOperation(this[pObjectName], where).execute()
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  deleteMany(match) {
    const v = new DeleteManyOperation(this[pObjectName], match)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  deleteOne(match) {
    const v = new DeleteOperation(this[pObjectName], match)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  find(where) {
    const v = new QueryCursor(this[pObjectName], where)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  readOne(where) {
    const v = new ReadOneOperation(this[pObjectName], where)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  insertMany(docs = []) {
    const v = new InsertManyOperation(this[pObjectName], docs)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  insertOne(doc = {}) {
    const v = new InsertOperation(this[pObjectName], doc)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  updateOne(match, doc) {
    const v = new UpdateOperation(this[pObjectName], match, doc)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  updateMany(match, doc) {
    const v = new UpdateManyOperation(this[pObjectName], match, doc)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  patchOne(match, doc) {
    const v = new PatchOperation(this[pObjectName], match, doc)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

  patchMany(match, doc) {
    const v = new PatchManyOperation(this[pObjectName], match, doc)
    return this[pThrough] ? v.through(this[pThrough]) : v
  }

}

export {
  Driver
}
