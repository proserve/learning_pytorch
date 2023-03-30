const { policy, route } = require('decorators')

class RuntimePolicyObject {

  @route('GET c_ctxapi689_policy', { name: 'c_policy_expression', weight: 1 })
  static getImplCtx689({ req, res, body }) {
    return 'The get request was executed!'
  }

  @route({
    weight: 1,
    method: 'POST',
    name: 'c_689_post',
    path: 'c_689_post_policy',
    acl: ['role.administrator']
  })
  postImplCtx689({ req, body }) {
    return `The post! The number is ${body('theNumber')}`
  }

  @policy({
    methods: ['get'],
    paths: '/routes/c_ctxapi689_policy',
    action: 'Script',
    if: { $not: {
      $eq: ['$$REQUEST.query.id', { $literal: 1212 }]
    }
    }
  })
  policyGet689() {
    throw new Error('Error occurred - Value is different than 1212')
  }

  @policy({
    methods: ['post'],
    paths: '/routes/c_689_post_policy',
    action: 'Script',
    if: { $gte: ['$$NOW', { $dateFromString: {
      dateString: '2020-10-03 00:00:03',
      format: 'YYYY-MM-DD HH:mm:ss',
      timezone: 'America/Cordoba',
      onError: null,
      onNull: new Date() }
    }]
    }
  })
  policyPost689() {
    throw new Error('Date is greater or equal on date limit configured')
  }

}
module.exports = RuntimePolicyObject
