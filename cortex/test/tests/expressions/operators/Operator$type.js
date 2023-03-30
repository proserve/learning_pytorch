const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      { ArrayOutputCursor } = require('cortex-service/lib/utils/output'),
      should = require('should'),
      { ObjectID } = require('cortex-service/lib/utils/ids'),
      sandboxed = require('../../../lib/sandboxed')

describe('Expressions - Operator$type', function() {

  it('Operator$type String', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: 'some string'
            }
          ),
          result = await ec.evaluate()

    should(result).equal('String')
  })

  it('Operator$type Boolean', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: true
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Boolean')
  })

  it('Operator$type Array', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: { $literal: ['a', 'b', 'c'] }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Array')
  })

  it('Operator$type RegExp', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: /abc/
            }
          ),
          result = await ec.evaluate()

    should(result).equal('RegExp')
  })

  it('Operator$type Number', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: 123
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Number')
  })

  it('Operator$type Null', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: null
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Null')
  })

  it('Operator$type Date', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: new Date()
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Date')
  })

  it('Operator$type ObjectId', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: new ObjectID('5f6d041f0000000000000000')
            }
          ),
          result = await ec.evaluate()

    should(result).equal('ObjectId')
  })

  it('Operator$type Object', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: { $literal: {} }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Object')
  })

  it('Operator$type Cursor', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: { $literal: new ArrayOutputCursor([1, 2, 3]) }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Cursor')
  })

  it('Operator$type Unknown', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: {
                $literal: class Voodoo {
                }
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Unknown')
  })

  it('Operator$type Binary', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: { $literal: Buffer.from('vampire slayer') }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('Binary')
  })

  it('Operator$type - scripting ', sandboxed(function() {

    const should = require('should'),
          { ObjectID } = global,
          { run } = require('expressions'),
          result = run({
            $object: {
              Array: { $type: { $literal: [] } },
              Binary: { $type: { $literal: new Buffer('1') } }, // eslint-disable-line node/no-deprecated-api
              Date: { $type: new Date() },
              Null: { $type: null },
              Number: { $type: 1 },
              Object: { $type: { $literal: {} } },
              ObjectId: { $type: new ObjectID() },
              RegExp: { $type: /foo/ },
              String: { $type: 'foo' }
            }
          })

    for (const [key, value] of Object.entries(result)) {
      should(key).equal(value)
    }

  }))

})
