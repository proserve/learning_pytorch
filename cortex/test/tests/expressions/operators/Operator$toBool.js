const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toBool', function() {

  it('Operator$toBool - toBool 0 should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: 0
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$toBool - toBool -0 should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: -0
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$toBool - toBool null should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: null
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$toBool - toBool false should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: false
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$toBool - toBool NaN should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: NaN
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$toBool - toBool undefined should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: undefined
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$toBool - toBool "" should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: ''
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$toBool - toBool true should be true', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: true
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$toBool - toBool "false" should be true', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toBool: 'false'
            }
          )

    should(await ec.evaluate()).equal(true)

  })

})
