import { trigger } from 'decorators'

class ctxapi1240Lib {

  @trigger('create.before', {
    object: 'c_ctxapi_1240_object',
    weight: 1,
    if: {
      $pathTo: [{
        $dbNext: {
          maxTimeMS: 10000,
          object: 'c_ctxapi_1240_object',
          operation: 'cursor',
          paths: {
            $array: ['c_boolean']
          }
        }
      }, 'c_boolean']
    }
  })
  trigger({ new: newInstance }) {
    script.arguments.new.update({ c_string: 'the trigger was executed'})
  }
}
