const { trigger } = require('decorators'),
      cache = require('cache')

class TriggerObject {

    @trigger('delete.before', {
      object: 'c_ctxapi_1256_object',
      weight: 1,
      paths: ['c_string']
    })
  static objectBeforeDelete({ context, old }) {
    cache.set(`${context.object}.${context._id}.before_delete`, old)
  }

  @trigger('delete.after', {
    object: 'c_ctxapi_1256_object',
    weight: 1,
    paths: ['c_string', 'c_another_string']
  })
    static objectAfterDelete({ context, old }) {
      cache.set(`${context.object}.${context._id}.after_delete`, old)
    }

}

module.exports = TriggerObject
