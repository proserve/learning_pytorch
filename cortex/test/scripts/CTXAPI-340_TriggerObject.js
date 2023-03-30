const { object, trigger } = require('decorators')

@object('c_ctxapi_340_trigger_object')
class TriggerObject extends CortexObject {

  @trigger('create.before', {
    label: 'c_ctxapi_340_original_trigger',
    name: 'c_340_before_create_trigger',
    object: 'c_ctxapi_340_trigger_object',
    weight: 1
  })
  beforeCreate({ context }) {
    context.update('c_before', new Date().getTime())
  }

  @trigger('create.after', { name: 'c_340_after_create_trigger', object: 'c_ctxapi_340_trigger_object', weight: 1 })
  afterCreate({ context }) {
    org.objects[context.object].updateOne({ _id: context._id }, {
      $set: {
        c_after: new Date().getTime()
      }
    }).execute()
  }

}

module.exports = TriggerObject
