'use strict'

const should = require('should'),
      server = require('../../lib/server'),
      { OutputCursor } = require('../../../lib/utils'),
      modules = require('../../../lib/modules'),
      { AccessContext } = require('../../../lib/acl')

describe('Issues - CTXAPI-716 cleaning up of sandbox-returned cursors.', function() {

  it('a cursor returned from Operator$function should be closed', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          result = await modules.expressions.createContext(ac,
            {
              $function: {
                body: `return org.objects.objects.find().skipAcl().grant('read').limit(1)`
              }
            }).evaluate()

    should(result instanceof OutputCursor).be.false()

  })

})
