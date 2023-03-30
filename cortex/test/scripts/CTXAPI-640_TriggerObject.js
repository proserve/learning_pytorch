const { trigger } = require('decorators'),
      cache = require('cache')

class TriggerObject {

  @trigger('update.after', {
    object: 'c_ctxapi_640_object',
    weight: 1,
    inline: true
  })
  depthTestTrigger({ context }) {
    if (context.c_count > 2) {
      try {
        org.objects.c_ctxapi_640_object.updateOne({
          _id: context._id
        }, {
          $set: {
            c_count: context.c_count - 1
          },
          $push: {
            c_depth_log: `${script.depth}`
          }
        }).execute()
      } catch (e) {
        cache.set(`ctxapi_640.${context._id}.error`, e, 30000)
      }
    } else {
      cache.set(`ctxapi_640.${context._id}.lastExecution`, `count: ${context.c_count} depth: ${script.depth}`, 30000)
    }

  }

}

module.exports = TriggerObject
