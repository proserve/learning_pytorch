const { trigger, route } = require('decorators'),
      { sleep } = require('debug'),
      cache = require('cache')

class Trigger601Object {

  @trigger('create.after', {
    object: 'account',
    weight: 1,
    inline: true
  })
  afterCreateAccountInline({ context }) {
    sleep(4000)
    org.objects.accounts.updateOne({ _id: context._id }, {
      $set: {
        c_axon_string: `Congratulations ${context.name.first}! You are connected now, yeeey!`
      }
    }).skipAcl().grant(6).execute()
  }

  @trigger('ctxapi601__the_event_inline.after', {
    object: 'system',
    weight: 1,
    inline: true
  })
  afterTheEventInline({ context }) {
    sleep(4000)
    cache.set('ctxapi-601-INLINE', 'Done', 60000)
  }

  @trigger('ctxapi601__the_event_not_inline.after', {
    object: 'system',
    weight: 1,
    inline: false
  })
  afterTheEventNotInline({ context }) {
    sleep(2000)
    cache.set('ctxapi-601-NOT-INLINE', 'Done', 60000)
  }

  @route('GET c_ctxapi601', { name: 'c_ctxapi601', weight: 1 })
  static getImpl({ req, res, body }) {
    return org.objects.account.register({
      name: {
        first: 'CTXAPI_601',
        last: 'User'
      },
      email: 'c_ctxapi_601@example.org',
      mobile: '15055555555'
    }, {
      skipVerification: true,
      skipActivation: true,
      skipNotification: true,
      requireMobile: false
    })
  }

}

module.exports = Trigger601Object
