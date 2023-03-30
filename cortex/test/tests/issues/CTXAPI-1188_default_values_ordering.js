'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-1188 Expression defaultValues are written before other properties.', function() {

  const theExpression = {
    '$cond': [
      {
        '$eq': [
          '$$ROOT.type',
          'c_type_a'
        ]
      },
      'this is type a',
      'this is type b'
    ]
  }

  before(async() => {
    await promised(null, sandboxed(function() {

      const {
              org: {
                objects: { Objects }
              },
              script: {
                arguments: { theExpression }
              }
            } = global,
            propertyDef = {
              label: 'some string',
              name: 'c_some_string',
              type: 'String',
              dependencies: [
                'type',
                'c_some_string' // <-- this should be okay.
              ],
              defaultValue: [ {
                type: 'expression',
                value: theExpression
              }
              ]
            }

      Objects.insertOne({
        name: 'c_ctxapi1188',
        label: 'c_ctxapi1188',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        objectTypes: [
          {
            label: 'type A',
            name: 'c_type_a',
            properties:
              [
                propertyDef,
                {
                  label: 'doc',
                  name: 'c_doc',
                  type: 'Document',
                  properties:
                  [
                    propertyDef
                  ]
                },
                {
                  label: 'doc',
                  name: 'c_doc_array',
                  type: 'Document',
                  array: true,
                  properties:
                  [
                    propertyDef
                  ]
                },
                {
                  label: 'Set',
                  name: 'c_typed_set',
                  type: 'Set',
                  documents: [
                    {
                      label: 'Doc',
                      name: 'c_doc',
                      properties:
                      [
                        propertyDef
                      ]
                    }
                  ]
                }
              ]
          },
          {
            label: 'type B',
            name: 'c_type_b',
            properties: []
          }
        ],
        properties: [
          propertyDef,
          {
            label: 'based on some string',
            name: 'c_base_on_some_string',
            type: 'String',
            dependencies: ['c_some_string'],
            defaultValue: [{
              type: 'expression',
              value: '$$ROOT.c_some_string'
            }]
          },
          {
            label: 'Set',
            name: 'c_set',
            type: 'Set',
            documents: [
              {
                label: 'Doc',
                name: 'c_doc',
                properties:
                  [
                    propertyDef
                  ]
              }
            ]
          }
        ]
      }).execute()

    }, {
      runtimeArguments: {
        theExpression
      }
    }))
  })

  it('should not allow circular dependencies to be saved', async function() {

    await promised(null, sandboxed(function() {

      const should = require('should'),

            {
              org: {
                objects: { Objects }
              }
            } = global

      let err

      try {
        Objects.insertOne({
          name: 'c_ctxapi1188_circular',
          label: 'c_ctxapi1188_circular',
          defaultAcl: 'owner.delete',
          createAcl: 'account.public',
          properties: [
            {
              label: 'c_foo',
              name: 'c_foo',
              type: 'String',
              dependencies: ['c_bar']
            },
            {
              label: 'c_bar',
              name: 'c_bar',
              type: 'String',
              dependencies: ['c_baz']
            },
            {
              label: 'c_baz',
              name: 'c_baz',
              type: 'String',
              dependencies: ['c_foo']
            }
          ]
        }).dryRun().execute()
      } catch (e) {
        err = e
      }

      should.exist(err)
      should.equal('cortex.invalidArgument.validation', err.errCode)

    }))

  })

  it('should allow dependencies to be saved', async function() {

    await promised(null, sandboxed(function() {

      const {
        org: {
          objects: { Objects }
        }
      } = global

      Objects.insertOne({
        name: 'c_ctxapi1188_deps',
        label: 'c_ctxapi1188_deps',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            label: 'c_foo',
            name: 'c_foo',
            type: 'String',
            dependencies: ['c_bar']
          },
          {
            label: 'c_bar',
            name: 'c_bar',
            type: 'String',
            dependencies: ['c_baz']
          },
          {
            label: 'c_baz',
            name: 'c_baz',
            type: 'String',
            dependencies: []
          }
        ]
      }).dryRun().execute()

    }))

  })

  it('should re-evaluate dependencies if a property is removed', async function() {

    await promised(null, sandboxed(function() {

      let err
      const {
              org: {
                objects: { Objects }
              }
            } = global,
            should = require('should')

      Objects.insertOne({
        name: 'c_ctxapi1188_eval',
        label: 'c_ctxapi1188_eval',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            label: 'c_foo',
            name: 'c_foo',
            type: 'String',
            dependencies: ['c_doc.c_baz']
          },
          {
            label: 'c_bar',
            name: 'c_bar',
            type: 'String',
            dependencies: []
          },
          {
            label: 'c_doc',
            name: 'c_doc',
            type: 'Document',
            properties: [
              {
                label: 'c_baz',
                name: 'c_baz',
                type: 'String',
                dependencies: ['c_bar']
              }
            ]
          }
        ]
      }).execute()

      try {
        Objects.updateOne({
          name: 'c_ctxapi1188_eval'
        }, {
          $remove: {
            properties: ['c_bar']
          }
        }).dryRun().execute()
      } catch (e) {
        err = e
      }

      should.exist(err)
      should.equal('cortex.invalidArgument.validation', err.errCode)

      Objects.updateOne({
        name: 'c_ctxapi1188_eval'
      }, {
        $remove: {
          properties: ['c_foo', 'c_doc']
        }
      }).dryRun().execute()

    }))

  })

  it('creating an instance with default values should be able to use the $$ROOT', async function() {

    await promised(null, sandboxed(function() {

      require('should')

      const {
              org: {
                objects: { c_ctxapi1188: Model }
              },
              script: {
                arguments: { theExpression }
              }
            } = global,
            typeA = Model.insertOne(
              {
                type: 'c_type_a',
                // c_doc: {}, <-- test to ensure non-array sub-properties with defaults are written
                c_doc_array: [{}],
                c_typed_set: [{ name: 'c_doc' }],
                c_set: [{ name: 'c_doc' }]
              }).lean(false).execute(),
            typeB = Model.insertOne(
              {
                type: 'c_type_b',
                c_set: [{ name: 'c_doc' }]
              }
            ).lean(false).execute()

      typeA.c_some_string.should.equal(theExpression.$cond[1])
      typeA.c_doc.c_some_string.should.equal(theExpression.$cond[1])
      typeA.c_doc_array[0].c_some_string.should.equal(theExpression.$cond[1])
      typeA.c_typed_set[0].c_some_string.should.equal(theExpression.$cond[1])
      typeA.c_set[0].c_some_string.should.equal(theExpression.$cond[1])
      typeA.c_base_on_some_string.should.equal(theExpression.$cond[1])

      typeB.c_some_string.should.equal(theExpression.$cond[2])
      typeB.c_set[0].c_some_string.should.equal(theExpression.$cond[2])
      typeB.c_base_on_some_string.should.equal(theExpression.$cond[2])

    }, {
      runtimeArguments: {
        theExpression
      }
    }))

  })

})
