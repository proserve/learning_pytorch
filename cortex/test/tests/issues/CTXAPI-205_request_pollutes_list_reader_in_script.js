'use strict'

/* global before */
/* global org, consts */

const server = require('../../lib/server'),
      should = require('should'),
      sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-205 - list reader polluted by request query in script', function() {

    before(sandboxed(function() {

      // create object
      org.objects.Object.insertOne({
        label: 'c_ctxapi_205_parent',
        name: 'c_ctxapi_205_parent',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: []
      }).execute()

      org.objects.Object.insertOne({
        label: 'c_ctxapi_205_child',
        name: 'c_ctxapi_205_child',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: []
      }).execute()

      org.objects.Object.updateOne({ name: 'c_ctxapi_205_child' }, { $push: {
        properties: [{
          label: 'c_b',
          name: 'c_b',
          type: 'String',
          indexed: true
        }]
      } }).execute()

      org.objects.Object.updateOne({ name: 'c_ctxapi_205_parent' }, { $push: {
        properties: [{
          label: 'c_a',
          name: 'c_a',
          type: 'String',
          indexed: true
        }, {
          label: 'c_children',
          name: 'c_children',
          type: 'List',
          readThrough: true,
          sourceObject: 'c_ctxapi_205_child'
        }]
      } }).execute()

      org.objects.c_ctxapi_205_parent.insertMany([{
        c_a: 'foo'
      }, {
        c_a: 'bar'
      }]).execute()

      org.objects.c_ctxapi_205_child.insertMany([{
        c_b: 'foo'
      }, {
        c_b: 'bar'
      }]).execute()

    }))

    // ------------------------------------------------

    it('calling from rest api should use query arguments', function(callback) {

      server.sessions.admin
        .get(server.makeEndpoint('/c_ctxapi_205_parent?paths[]=c_a&paths[]=c_children.c_b&where={"c_a": "foo"}&c_children.where={"c_b": "bar"}'))
        .set(server.getSessionHeaders())

        .done(function(err, result) {
          should.not.exist(err)
          result.data.length.should.equal(1)
          result.data[0].c_a.should.equal('foo')
          result.data[0].c_children.data.length.should.equal(1)
          result.data[0].c_children.data[0].c_b.should.equal('bar')
          callback()
        })

    })

    it('calling from a script runner should not use request query', function(callback) {

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner?paths[]=c_a&paths[]=c_children.c_b&where={"c_a": "foo"}&c_children.where={"c_b": "bar"}'))
        .set(server.getSessionHeaders())
        .send({
          language: 'javascript',
          specification: 'es6',
          script: `                               
            return org.objects.c_ctxapi_205_parent.find().paths('c_a', 'c_children.c_b').passthru()                    
          `
        })
        .done(function(err, result) {
          should.not.exist(err)
          result.data.length.should.equal(2)
          result.data[0].c_children.data.length.should.equal(2)
          callback()
        })

    })

    it('calling from a script runner with a projection should match results', function(callback) {

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(server.getSessionHeaders())
        .send({
          language: 'javascript',
          specification: 'es6',
          script: `                               
            return org.objects.c_ctxapi_205_parent.aggregate()
              .match({
                  c_a: 'foo'
              })
              .project({
                  c_a: 1,
                  c_children: {$expand: {
                      paths: 'c_b',
                      where: {
                          c_b: 'bar'
                      }
                  }}
              })                  
          `
        })
        .done(function(err, result) {
          should.not.exist(err)
          result.data.length.should.equal(1)
          result.data[0].c_a.should.equal('foo')
          result.data[0].c_children.data.length.should.equal(1)
          result.data[0].c_children.data[0].c_b.should.equal('bar')
          callback()
        })

    })

  })

})
