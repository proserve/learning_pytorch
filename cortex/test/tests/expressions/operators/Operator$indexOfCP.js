const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$indexOfCP', function() {

  it('Operator$indexOfCP with unicode chars', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfCP: ['cafétéria', 'é']
            }
          )

    should(await ec.evaluate()).equal(3)

  })

  it('Operator$indexOfCP with single bytes chars', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfCP: ['cafeteria', 'e']
            }
          )

    should(await ec.evaluate()).equal(3)

  })

  it('Operator$$indexOfCP char after unicode', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfCP: [ 'cafétéria', 't' ]
            }
          )

    should(await ec.evaluate()).equal(4)

  })

  it('Operator$$indexOfCP with start / end', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfCP: [ 'foo.bar.fi', '.', 5 ]
            }
          )

    should(await ec.evaluate()).equal(7)

  })

  it('Operator$$indexOfCP with null input', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfCP: [ null, 't', 1, 6 ]
            }
          )

    should(await ec.evaluate()).equal(null)

  })

})
