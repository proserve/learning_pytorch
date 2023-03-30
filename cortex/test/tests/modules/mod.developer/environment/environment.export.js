'use strict'

const { getEnvironment } = require('./setup'),
      should = require('should'),
      modules = require('../../../../../lib/modules'),
      { AccessContext } = require('../../../../../lib/acl'),
      { promised } = require('../../../../../lib/utils')

describe('Modules', function() {

  describe('Developer', function() {

    it('example test', async() => {

      const environment = await getEnvironment(),
            cursor = await promised(modules.developer, 'exportEnvironment', new AccessContext(environment.principals.admin)),
            array = []

      while (await promised(cursor, 'hasNext')) {
        array.push(await promised(cursor, 'next'))
      }

      should('be an object definition', array.find(r => r.name === 'c_custom_object'))

    })

  })

})
