const supertest = require('supertest'),
      sinon = require('sinon'),
      should = require('should'),
      modules = require('../../../../lib/modules'),
      acl = require('../../../../lib/acl'),
      RuntimeOperation = require('../../../../lib/modules/runtime/operations/runtime-operation'),
      server = require('../../../lib/server')

describe('CTXAPI-1947 - RuntimeOperation parentage missing for rest api db-driver operation', function() {

  let spy

  before(function() {
    spy = sinon.spy(modules.driver.Driver.prototype, 'executeOperation')
  })

  after(function() {
    spy.restore()
  })

  it('DB driver execute operation method should have access to the parent operation when triggered from POST /:objects/db/:operation', function(done) {

    function makeAssertions(err, res) {

      should.not.exist(err)

      spy.calledOnce.should.be.true()
      spy.args[0].should.have.length(4)
      spy.args[0][0].should.equal('count')
      should.exist(spy.args[0][3].parent)
      spy.args[0][3].parent.should.be.instanceOf(RuntimeOperation)

      done()

    }

    modules.authentication.createToken(
      new acl.AccessContext(server.principals.admin),
      server.principals.admin.email,
      server.sessionsClient.key,
      {
        scope: ['object.read.idp.*.name']
      },
      (err, { token }) => {

        should.not.exist(err)

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/idp/db/count'))
          .set({ 'Authorization': `Bearer ${token}` })
          .done(makeAssertions)

      })

  })

})
