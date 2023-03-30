const { object, trigger } = require('decorators')

@object('c_ctxapi_340_trigger_object')
class MyCustomTrigger {

  @trigger('create.before', {
    label: 'c_ctxapi_340_overriding_trigger',
    name: 'c_340_before_create_trigger',
    object: 'c_ctxapi_340_trigger_object',
    weight: 2
  })
  beforeCreate({ context }) {
    context.update('c_before', 'overwritten data')
  }

}

module.exports = MyCustomTrigger
