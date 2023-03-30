const { transform } = require('decorators-transform')

// cs__namespace testing customName
@transform
class Transformer {

  error(err) {
    throw Fault.create('axon.error.transformed', { faults: [err] })
  }

  beforeAll(memo, { cursor }) {
    const should = require('should')

    should.equal(cursor.hasNext(), true)
    should.equal(cursor.isClosed(), false)

    cursor.push({
      message: 'Before anything'
    })
    memo.beforeAll = true
    memo.count = 0
  }

  before(memo, { cursor }) {
    const should = require('should')

    should.equal(cursor.hasNext(), true)
    should.equal(cursor.isClosed(), false)

    memo.before = true
    cursor.push({
      message: 'Before goes before after'
    })
  }

  result(result) {
    const res = require('response')
    res.setHeader('X-The-Result', 'true')

    result.c_the_result = true

    return result
  }

  each(object, memo, { cursor }) {
    memo.count++
    let c_string = object.c_string
    object.c_transformed = true

    cursor.push({
      message: 'Transforming ' + c_string
    })

    return object
  }

  after(memo, { cursor }) {
    const should = require('should')

    should.equal(cursor.hasNext(), false)
    should.equal(cursor.isClosed(), true)

    memo.after = true
    cursor.push({
      message: 'After comes after before'
    })
  }

  afterAll(memo, { cursor }) {
    const should = require('should')

    should.equal(cursor.hasNext(), false)
    should.equal(cursor.isClosed(), true)

    memo.afterAll = true
    cursor.push({
      message: 'Wrapping up!'
    })
    cursor.push({
      object: 'memo',
      ...memo
    })
  }

}

module.exports = Transformer
