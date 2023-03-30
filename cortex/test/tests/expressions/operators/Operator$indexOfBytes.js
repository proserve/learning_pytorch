const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$indexOfBytes', function() {

  it('Operator$indexOfBytes with unicode chars', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfBytes: ['cafétéria', 'é']
            }
          )

    should(await ec.evaluate()).equal(3)

  })

  it('Operator$indexOfBytes with single bytes chars', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfBytes: ['cafeteria', 'e']
            }
          )

    should(await ec.evaluate()).equal(3)

  })

  it('Operator$indexOfBytes char after unicode', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfBytes: [ 'cafétéria', 't' ]
            }
          )

    should(await ec.evaluate()).equal(5)

  })

  it('Operator$indexOfBytes with start / end', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfBytes: [ 'cafétéria', 't', 1, 6 ]
            }
          )

    should(await ec.evaluate()).equal(4)

  })

  it('Operator$indexOfBytes with null input', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfBytes: [ null, 't', 1, 6 ]
            }
          )

    should(await ec.evaluate()).equal(null)

  })

})
