const { trigger, policy, route } = require('decorators'),
      { Transform } = require('runtime.transform'),
      { transform } = require('decorators-transform'),
      _ = require('underscore')

class TriggerObject {

  @trigger('update.before', {
    object: 'c_ctxapi_489_object',
    principal: null,
    weight: 1
  })
  beforeUpdateAnnotated({ context, body }) {
    let stringArr = script.arguments.old.c_strings || []
    stringArr.push(JSON.stringify(body()))
    context.update('c_strings', stringArr)
  }

  @trigger('create.before', {
    object: 'c_ctxapi_489_object',
    principal: null,
    weight: 1
  })
  beforeCreateAnnotated({ body }) {
    if (body('c_string') === 'Danger') {
      body('c_string', 'Should not be able to edit!')
      body('c_strings', ['Should', 'not', 'edit', 'this', 'array'])
    }
  }

  @route('POST c_ctxapi_489_object')
  getAllAccounts({ req, res, body, runtime }) {
    return org.objects.c_ctxapi_489_object.find()
  }

  @policy
  static transformPolicy = {
    name: 'c_489_transform_policy',
    priority: 999,
    methods: 'post',
    paths: '/routes/c_ctxapi_489_object',
    action: 'Transform',
    transform: 'c_ctxapi_489_transform',
    environment: 'development'
  }

}

@transform('c_ctxapi_489_transform', { environment: 'development' })
class Transform489 extends Transform { // eslint-disable-line no-unused-vars

  beforeAll(memo) {
    memo.filteredOut = 0
  }

  each(object, memo, { cursor, body }) {

    if (body('filter')) {
      if (_.size(body('blacklist')) && body('blacklist').includes(object.c_string)) {
        // This edit should do nothing to the body
        body('blacklist', null)
        memo.filteredOut += 1
        return undefined
      }
    }

    return object
  }

  afterAll(memo, { cursor, body }) {
    cursor.push(`Transform is done! Filtered ${memo.filteredOut} elements out. Body was ${JSON.stringify(body())}`)
  }

}

module.exports = TriggerObject
