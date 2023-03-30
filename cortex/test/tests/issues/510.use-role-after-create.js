'use strict'

const consts = require('../../../lib/consts'),
      sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('510 - Use a custom role immediately after creation within the same script context.', function() {

    it('should create a role and then an object using the created role.', sandboxed(function() {

      /* global org, script */

      require('should')

      const roles = org.push('roles', { name: 'Issue510' }),
            roleId = roles[roles.length - 1]._id,
            Issue510 = org.objects.c_issue_510

      // the roles will not be part of the script consts in this run.
      org.objects.object.insertOne({
        label: 'Issue 510',
        name: 'c_issue_510',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.role, target: roleId }]
      }).execute()

      // the principal should update as well.
      script.principal.push('roles', roleId)

      Issue510.insertOne({}).execute()

    }))

  })

})
