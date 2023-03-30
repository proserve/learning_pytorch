const { trigger } = require('decorators')

class ExpressionsTrigger689 {

  @trigger('create.after', {
    label: 'c_ctxapi_689_band_trigger',
    name: 'c_ctxapi_689_band_trigger',
    object: 'c_ctxapi_689_band',
    weight: 1,
    inline: true,
    if: {
      $toBool: {
        $find: {
          input: '$c_band',
          as: 'elem',
          cond: {
            $or: [
              { $eq: ['$$elem', 'John'] },
              { $eq: ['$$elem', 'Paul'] },
              { $eq: ['$$elem', 'George'] },
              { $eq: ['$$elem', 'Ringo'] }
            ]
          }
        }
      }
    }
  })
  afterCreate689({ context }) {

    org.objects[context.object].updateOne({ _id: context._id }, {
      $set: {
        c_beatle: true
      }
    }).execute()
  }

  @trigger('create.before', {
    label: 'c_ctxapi_689_phrase_trigger',
    name: 'c_ctxapi_689_phrase_trigger',
    object: 'c_ctxapi_689_phrase',
    weight: 1,
    inline: true,
    if: {
      $cond: {
        if: {
          $eq: [{
            $reduce: {
              input: '$c_phrase',
              initialValue: '',
              in: {
                $concat: [ '$$this', '$$value' ]
              }
            }
          }, 'THESECRETWORD' ]
        },
        then: false,
        else: {
          $not: {
            $eq: [ '$c_manager', 'Brian' ]
          }
        }
      }
    }
  })
  beforeCreate689({ context }) {
    throw Fault.create('cortex.accessDenied.phrase', { reason: 'The phrase is wrong!' })
  }

}

module.exports = ExpressionsTrigger689
