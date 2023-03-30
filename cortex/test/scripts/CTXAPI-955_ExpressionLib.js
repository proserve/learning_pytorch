const { expressions: { expression, pipeline } } = require('decorators')

class AwesomeExpressions {

    @pipeline
    // eslint-disable-next-line camelcase
    aexp__set_random = [
      {
        $set: {
          random: '$$RANDOM'
        }
      }
    ]

    /**
     * acl expression
     */
    @expression
    aexp__pick_values = { $pick: ['$$ROOT', 'email', 'mobile'] }

    /**
     * acl expression $if conditional example. (acl = '$if.namespaced__acl_if.read')
     */
    @expression
    aexp__acl_gaston_if = { $eq: ['$$ROOT.c_who', 'gaston@medable.com'] }

    /**
     * acl expression $acl example. (acl = '$if.namespaced__acl_grant')
     */
    @expression
    aexp__acl_joaquin_grant = { $cond: [{ $ne: ['$$ROOT.c_who', 'joaquin@medable.com'] }, 'delete', 'none'] }

}

module.exports = AwesomeExpressions
