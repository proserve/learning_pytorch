const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$trim', function() {

  it('Operator$trim default char', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $trim: {
                input: ' probando mi string '
              }
            }
          )

    should(await ec.evaluate()).equal('probando mi string')

  })

  it('Operator$trim specific chars', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $trim: {
                input: '#//#//probando mi string#//#//',
                chars: '#//'
              }
            }
          )

    should(await ec.evaluate()).equal('probando mi string')

  })

})
