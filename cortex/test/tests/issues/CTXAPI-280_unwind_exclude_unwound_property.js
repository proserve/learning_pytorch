'use strict'

const sandboxed = require('../../lib/sandboxed'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_280.deleteMany({}).execute()
        should.equal(org.objects.c_ctxapi_280.find().count(), 0)
      }

describe('Bugfix - fix issue with $unwind removing unwound property', function() {

  after(sandboxed(cleanInstances))

  before(sandboxed(function() {
    /* global consts, ObjectID */
    org.objects.objects.insertOne({
      label: 'CTXAPI-280',
      name: 'c_ctxapi_280',
      defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
      createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
      properties: [
        { label: 'name', name: 'c_name', type: 'String', indexed: true },
        { label: 'years', name: 'c_year', type: 'Number', array: true, indexed: true },
        { label: 'stakeholders',
          name: 'c_stakeholder',
          type: 'Document',
          properties: [
            { label: 'users', name: 'c_user', type: 'ObjectId', array: true, indexed: true }
          ] }
      ]
    }).execute()

    org.objects.c_ctxapi_280.insertMany([
      {
        c_name: 'Gaston',
        c_year: [2010, 2011, 2012],
        c_stakeholder: {
          c_user: [new ObjectID('5d67df28091037c5a4a203e4'), new ObjectID('5d67df37091037c5a4a203e5'), new ObjectID('5d67df3d091037c5a4a203e6')]
        }
      },
      {
        c_name: 'James',
        c_year: [2011, 2013],
        c_stakeholder: {
          c_user: [new ObjectID('5d67df3d091037c5a4a203e7'), new ObjectID('5d67df3d091037c5a4a203e8')]
        }
      },
      {
        c_name: 'Joaquin',
        c_year: [2018],
        c_stakeholder: {
          c_user: [new ObjectID('5d67df3d091037c5a4a203e9')]
        }
      }
    ]).execute()

  }))

  it('use $unwind by root property c_years and check if present', sandboxed(function() {
    require('should')
    /* global org */
    const data = org.objects.c_ctxapi_280.aggregate([
      {
        $project: {
          c_name: 1,
          c_year: 1
        }
      },
      {
        $unwind: 'c_year'
      }
    ]).toArray()
    data.length.should.equal(6)
    data[0].c_name.should.equal(data[1].c_name)
    data[0].c_year.should.equal(2010)
    data[1].c_year.should.equal(2011)
    data[2].c_year.should.equal(2012)
    data[3].c_year.should.equal(2011)
    data[4].c_year.should.equal(2013)
    data[5].c_year.should.equal(2018)
  }))

  it('use $unwind by project document property c_user and check if present', sandboxed(function() {
    require('should')
    /* global org */
    const data = org.objects.c_ctxapi_280.aggregate([
      {
        $project: {
          c_name: 1,
          c_user: 'c_stakeholder.c_user'
        }
      },
      {
        $unwind: 'c_user'
      }
    ]).toArray()
    data.length.should.equal(6)
    data[0].c_name.should.equal(data[1].c_name)
    data[0].c_user.toString().should.equal('5d67df28091037c5a4a203e4')
    data[1].c_user.toString().should.equal('5d67df37091037c5a4a203e5')
    data[2].c_user.toString().should.equal('5d67df3d091037c5a4a203e6')
    data[3].c_user.toString().should.equal('5d67df3d091037c5a4a203e7')
    data[4].c_user.toString().should.equal('5d67df3d091037c5a4a203e8')
    data[5].c_user.toString().should.equal('5d67df3d091037c5a4a203e9')
  }))

})
