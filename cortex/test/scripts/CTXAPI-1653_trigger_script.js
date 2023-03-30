import { trigger } from 'decorators'
import cache from 'cache'

class ctxapi1653Lib {

  @trigger('update.before', {
    object: 'c_ctxapi_1653',
    weight: 1
  })
  trigger({ new: newInstance }) {
    cache.set('modifiedPaths', script.arguments.new)
  }
}