const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('Expressions - Custom prop validators using expressions', function() {

  before(sandboxed(function() {
    /* global org */
    org.objects.objects.insertOne({
      name: 'c_ctxapi_661_object',
      label: 'CTXAPI-611 Object with expression validators',
      defaultAcl: 'role.administrator.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'Validated String',
        name: 'c_string',
        type: 'String',
        indexed: true
      }]
    }).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_661_object' }).execute()
  }))

  afterEach(sandboxed(function() {
    org.objects.objects.updateOne({ name: 'c_ctxapi_661_object' }, {
      $set: {
        properties: {
          name: 'c_string',
          validators: []
        }
      }
    }).execute()
  }))

  it('should validate if instance is new', async() => {
    let objectDef, insert, update, err

    objectDef = await promised(null, sandboxed(function() {
      const { Objects } = org.objects

      return Objects.updateOne({
        name: 'c_ctxapi_661_object'
      }, {
        $set: {
          properties: {
            name: 'c_string',
            validators: [{
              name: 'expression',
              definition: {
                $cond: {
                  if: '$subject.isNew',
                  then: true,
                  else: {
                    $throw: 'axon.accessDenied.newOnly'
                  }
                }
              }
            }]
          }
        }
      }).lean(false).execute()

    }))

    should.exist(objectDef)
    should.equal(objectDef.object, 'object')
    should.equal(objectDef.properties.length, 1)
    should.exist(objectDef.properties[0].validators)
    should.equal(objectDef.properties[0].validators.length, 1)

    objectDef.properties[0].validators[0].should.containDeep({
      name: 'expression',
      definition: {
        $cond: {
          if: '$subject.isNew',
          then: true,
          else: {
            $throw: 'axon.accessDenied.newOnly'
          }
        }
      }
    })

    insert = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_661_object.insertOne({ c_string: 'initial value' }).lean(false).execute()
    }))

    should.exist(insert)
    insert.should.containDeep({
      object: 'c_ctxapi_661_object',
      c_string: 'initial value'
    })

    try {
      update = await promised(null, sandboxed(function() {
        /* global script */
        return org.objects.c_ctxapi_661_object.updateOne({
          _id: script.arguments._id
        }, {
          $set: {
            c_string: 'updated value'
          }
        }).lean(false).execute()
      }, {
        runtimeArguments: {
          _id: insert._id
        }
      }))
    } catch (e) {
      err = e
    }

    should.not.exist(update)
    should.exist(err)
    err.should.containDeep({
      object: 'fault',
      name: 'error',
      code: 'kValidationError',
      errCode: 'cortex.invalidArgument.validation',
      statusCode: 400,
      reason: 'Validation error.',
      faults: [
        {
          object: 'fault',
          name: 'fault',
          code: 'kAccessDenied',
          errCode: 'axon.accessDenied.newOnly',
          statusCode: 500,
          message: '',
          path: 'c_ctxapi_661_object.c_string',
          resource: `c_ctxapi_661_object._id(${insert._id}).c_string`
        }
      ],
      message: 'Script error'
    })
  })

  it('should validate based on prop value', async() => {
    let objectDef, insert, update, err

    objectDef = await promised(null, sandboxed(function() {
      const { Objects } = org.objects

      return Objects.updateOne({
        name: 'c_ctxapi_661_object'
      }, {
        $set: {
          properties: {
            name: 'c_string',
            validators: [{
              name: 'expression',
              definition: {
                $cond: {
                  if: {
                    $eq: ['$value', 'theBirdIsTheWord']
                  },
                  then: true,
                  else: {
                    $throw: 'axon.accessDenied.wrongValue'
                  }
                }
              }
            }]
          }
        }
      }).lean(false).execute()

    }))

    should.exist(objectDef)
    should.equal(objectDef.object, 'object')
    should.equal(objectDef.properties.length, 1)
    should.exist(objectDef.properties[0].validators)
    should.equal(objectDef.properties[0].validators.length, 1)

    objectDef.properties[0].validators[0].should.containDeep({
      name: 'expression',
      definition: {
        $cond: {
          if: {
            $eq: ['$value', 'theBirdIsTheWord']
          },
          then: true,
          else: {
            $throw: 'axon.accessDenied.wrongValue'
          }
        }
      }
    })

    insert = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_661_object.insertOne({ c_string: 'theBirdIsTheWord' }).lean(false).execute()
    }))

    should.exist(insert)
    insert.should.containDeep({
      object: 'c_ctxapi_661_object',
      c_string: 'theBirdIsTheWord'
    })

    try {
      update = await promised(null, sandboxed(function() {
        /* global script */
        return org.objects.c_ctxapi_661_object.updateOne({
          _id: script.arguments._id
        }, {
          $set: {
            c_string: 'the eagle is the word'
          }
        }).lean(false).execute()
      }, {
        runtimeArguments: {
          _id: insert._id
        }
      }))
    } catch (e) {
      err = e
    }

    should.not.exist(update)
    should.exist(err)
    err.should.containDeep({
      object: 'fault',
      name: 'error',
      code: 'kValidationError',
      errCode: 'cortex.invalidArgument.validation',
      statusCode: 400,
      reason: 'Validation error.',
      faults: [
        {
          object: 'fault',
          name: 'fault',
          code: 'kAccessDenied',
          errCode: 'axon.accessDenied.wrongValue',
          statusCode: 500,
          message: '',
          path: 'c_ctxapi_661_object.c_string',
          resource: `c_ctxapi_661_object._id(${insert._id}).c_string`
        }
      ],
      message: 'Script error'
    })
  })

})
