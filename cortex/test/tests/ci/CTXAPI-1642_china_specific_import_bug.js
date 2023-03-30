const { isReadableStream } = require('../../../lib/utils'),
      should = require('should')

describe('CTXAPI-1642 China specific import', function() {

  it('The isReadableStream method is exportable from Cortex API utilities', function() {

    should.exist(isReadableStream)

  })

})