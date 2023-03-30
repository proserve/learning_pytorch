const { trigger } = require('decorators'),
      cache = require('cache')

class TriggerObject {

  @trigger('update.before', {
    name: 'c_515_before_update_trigger',
    object: 'c_ctxapi_515_object',
    weight: 1
  })
  beforeUpdate({ context, modified }) {
    cache.set(`${context.object}.${context._id}.bu.modified`, JSON.stringify(modified.sort()))
    cache.set(`${context.object}.${context._id}.bu.modified.script`, JSON.stringify(script.arguments.modified.sort()))
  }

  @trigger('update.after', {
    name: 'c_515_after_update_trigger',
    object: 'c_ctxapi_515_object',
    weight: 1
  })
  afterUpdate({ context, modified }) {
    cache.set(`${context.object}.${context._id}.au.modified`, JSON.stringify(modified.sort()))
    cache.set(`${context.object}.${context._id}.au.modified.script`, JSON.stringify(script.arguments.modified.sort()))
  }

  @trigger('create.before', {
    name: 'c_515_before_create_trigger',
    object: 'c_ctxapi_515_object',
    weight: 1
  })
  beforeCreate({ context, modified }) {
    cache.set(`${context.object}.${context._id}.bc.modified`, JSON.stringify(modified.sort()))
    cache.set(`${context.object}.${context._id}.bc.modified.script`, JSON.stringify(script.arguments.modified.sort()))
  }

  @trigger('create.after', {
    name: 'c_515_after_create_trigger',
    object: 'c_ctxapi_515_object',
    weight: 1
  })
  afterCreate({ context, modified }) {
    cache.set(`${context.object}.${context._id}.ac.modified`, JSON.stringify(modified.sort()))
    cache.set(`${context.object}.${context._id}.ac.modified.script`, JSON.stringify(script.arguments.modified.sort()))
  }

}

module.exports = TriggerObject
