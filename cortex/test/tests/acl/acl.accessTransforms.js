'use strict'

const consts = require('../../../lib/consts'),
      sandboxed = require('../../lib/sandboxed')

describe('Acl', function() {

  describe('Access Transforms', function() {

    before(sandboxed(function() {

      /* global org */

      org.push('roles', [{
        name: 'TransformRead',
        code: 'c_TransformRead'
      }, {
        name: 'TransformUpdate',
        code: 'c_TransformUpdate'
      }])

      const roles = org.read('roles'),
            TransformRead = roles.find(v => v.code === 'c_TransformRead')._id,
            TransformUpdate = roles.find(v => v.code === 'c_TransformUpdate')._id

      try {
        org.objects.object.insertOne({
          label: 'AT Study',
          name: 'c_at_study',
          defaultAcl: [],
          createAcl: [],
          shareAcl: [],
          properties: [{
            label: 'String',
            name: 'c_string',
            type: 'String'
          }]
        }).execute()
      } catch (e) {}

      // a user would have 1 of these for each study they can access.
      org.objects.object.insertOne({
        label: 'AT Account',
        name: 'c_at_account',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.read }],
        createAcl: [],
        properties: [
          {
            label: 'Study',
            name: 'c_study_list',
            type: 'List',
            sourceObject: 'c_at_study',
            creatable: true,
            writeAccess: consts.accessLevels.script,
            readThrough: true,
            writeThrough: true,
            accessTransforms: [{
              name: 'direct',
              target: 'roles',
              action: 'union',
              property: 'c_roles' // <-- relative to reference
            }],
            inheritInstanceRoles: true,
            grant: consts.accessLevels.public,
            defaultAcl: [{
              type: consts.accessTargets.role,
              target: TransformRead,
              allow: consts.accessLevels.connected
            }, {
              type: consts.accessTargets.role,
              target: TransformUpdate,
              allow: consts.accessLevels.read
            }]
          },
          {
            label: 'Study',
            name: 'c_study',
            type: 'Reference',
            sourceObject: 'c_at_study',
            creatable: true,
            writeAccess: consts.accessLevels.script,
            expandable: true,
            writeThrough: true,
            accessTransforms: [{
              name: 'direct',
              target: 'roles',
              action: 'union',
              property: 'c_roles' // <-- relative to reference
            }],
            inheritInstanceRoles: true,
            grant: consts.accessLevels.public,
            defaultAcl: [{
              type: consts.accessTargets.role,
              target: TransformRead,
              allow: consts.accessLevels.connected
            }, {
              type: consts.accessTargets.role,
              target: TransformUpdate,
              allow: consts.accessLevels.read
            }],
            validators: [{
              name: 'uniqueInArray'
            }]
          }, {
            label: 'Roles',
            name: 'c_roles',
            type: 'String',
            array: true,
            uniqueValues: true,
            writable: true,
            writeAccess: consts.accessLevels.script
          },
          {
            label: 'Studies',
            name: 'c_studies',
            type: 'Document',
            array: true,
            writeAccess: consts.accessLevels.script,
            properties: [{
              label: 'Study',
              name: 'c_study',
              type: 'Reference',
              sourceObject: 'c_at_study',
              creatable: true,
              writeAccess: consts.accessLevels.script,
              expandable: true,
              writeThrough: true,
              accessTransforms: [{
                name: 'direct',
                target: 'roles',
                action: 'union',
                property: 'c_roles' // <-- relative to reference
              }],
              inheritInstanceRoles: true,
              grant: consts.accessLevels.public,
              defaultAcl: [{
                type: consts.accessTargets.role,
                target: TransformRead,
                allow: consts.accessLevels.read
              }, {
                type: consts.accessTargets.role,
                target: TransformUpdate,
                allow: consts.accessLevels.update
              }],
              validators: [{
                name: 'uniqueInArray'
              }]
            }, {
              label: 'Roles',
              name: 'c_roles',
              type: 'String',
              array: true,
              uniqueValues: true,
              writable: true,
              writeAccess: consts.accessLevels.script
            }]
          }
        ],
        objectTypes: [{
          label: 'A',
          name: 'c_a',
          properties: [
            {
              label: 'Studies',
              name: 'c_studies_a',
              type: 'Document',
              array: true,
              writeAccess: consts.accessLevels.script,
              properties: [{
                label: 'Study',
                name: 'c_study',
                type: 'Reference',
                sourceObject: 'c_at_study',
                creatable: true,
                writeAccess: consts.accessLevels.script,
                expandable: true,
                writeThrough: true,
                accessTransforms: [{
                  name: 'direct',
                  target: 'roles',
                  action: 'union',
                  property: 'c_roles' // <-- relative to reference
                }],
                inheritInstanceRoles: true,
                grant: consts.accessLevels.public,
                defaultAcl: [{
                  type: consts.accessTargets.role,
                  target: TransformRead,
                  allow: consts.accessLevels.read
                }, {
                  type: consts.accessTargets.role,
                  target: TransformUpdate,
                  allow: consts.accessLevels.update
                }],
                validators: [{
                  name: 'uniqueInArray'
                }]
              }, {
                label: 'Roles',
                name: 'c_roles',
                type: 'String',
                array: true,
                uniqueValues: true,

                writable: true,
                writeAccess: consts.accessLevels.script
              }]
            }
          ]
        }, {
          label: 'B',
          name: 'c_b',
          properties: [
            {
              label: 'Studies',
              name: 'c_studies_b',
              type: 'Document',
              array: true,
              writeAccess: consts.accessLevels.script,
              properties: [{
                label: 'Study',
                name: 'c_study',
                type: 'Reference',
                sourceObject: 'c_at_study',
                creatable: true,
                writeAccess: consts.accessLevels.script,
                expandable: true,
                writeThrough: true,
                accessTransforms: [{
                  name: 'direct',
                  target: 'roles',
                  action: 'union',
                  property: 'c_roles' // <-- relative to reference
                }],
                inheritInstanceRoles: true,
                grant: consts.accessLevels.public,
                defaultAcl: [{
                  type: consts.accessTargets.role,
                  target: TransformRead,
                  allow: consts.accessLevels.read
                }, {
                  type: consts.accessTargets.role,
                  target: TransformUpdate,
                  allow: consts.accessLevels.update
                }],
                validators: [{
                  name: 'uniqueInArray'
                }]
              }, {
                label: 'Roles',
                name: 'c_roles',
                type: 'String',
                array: true,
                uniqueValues: true,
                writable: true,
                writeAccess: consts.accessLevels.script
              }]
            }
          ]
        }]
      }).execute()

      org.objects.c_at_account.insertOne({
        type: 'c_a',
        c_study: org.objects.c_at_study.insertOne({ c_string: 'foo' }).bypassCreateAcl().grant(8).execute(),
        c_roles: ['c_TransformRead'],
        c_studies_a: [{
          c_study: org.objects.c_at_study.insertOne({ c_string: 'foo' }).bypassCreateAcl().grant(8).execute(),
          c_roles: []
        }, {
          c_study: org.objects.c_at_study.insertOne({ c_string: 'bar' }).bypassCreateAcl().grant(8).execute(),
          c_roles: ['c_TransformUpdate']
        }],
        c_studies: [{
          c_study: org.objects.c_at_study.insertOne({ c_string: 'foo' }).bypassCreateAcl().grant(8).execute(),
          c_roles: ['c_TransformRead']
        }, {
          c_study: org.objects.c_at_study.insertOne({ c_string: 'bar' }).bypassCreateAcl().grant(8).execute(),
          c_roles: ['c_TransformUpdate']
        }]
      }).bypassCreateAcl().grant(8).execute()

    }))

    it('Transform roles for lists and references', sandboxed(function() {

      /* global org */

      require('should')

      const roles = org.read('roles'),
            { inIdArray } = require('util.id'),
            TransformRead = roles.find(v => v.code === 'c_TransformRead')._id,
            TransformUpdate = roles.find(v => v.code === 'c_TransformUpdate')._id,
            doc = org.objects.c_at_account
              .find()
              .include('c_study_list')
              .expand('c_study', 'c_studies.c_study', 'c_studies_a.c_study')
              .next()

      doc.c_study.access.should.equal(consts.accessLevels.connected)
      inIdArray(doc.c_study.accessRoles, TransformRead).should.be.true()

      doc.c_study_list.data.every(v => v.access === consts.accessLevels.connected && inIdArray(v.accessRoles, TransformRead)).should.be.true()

      doc.c_studies[0].c_study.access.should.equal(consts.accessLevels.read)
      inIdArray(doc.c_studies[0].c_study.accessRoles, TransformRead).should.be.true()

      doc.c_studies[1].c_study.access.should.equal(consts.accessLevels.update)
      inIdArray(doc.c_studies[1].c_study.accessRoles, TransformUpdate).should.be.true()

      doc.c_studies_a[0].c_study.access.should.equal(consts.accessLevels.public)

      doc.c_studies_a[1].c_study.access.should.equal(consts.accessLevels.update)
      inIdArray(doc.c_studies[1].c_study.accessRoles, TransformUpdate).should.be.true()

    }))

  })

})
