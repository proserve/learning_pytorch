'use strict'
const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      assert = require('assert'),
      { promised } = require('../../../lib/utils')


describe('Issues - CTXAPI-1609 - increase config max storage', function() {

  it('should verify config key max storage', async function() {

    // key within range gets created successfully
    await promised(null ,modules.config.set, server.org, 'my-key', '12');
    const v = await promised(null ,modules.config.get, server.org, 'my-key');
    assert.strictEqual(v, '12');

    // key outside range throws an error
    await assert.rejects(
      promised(null ,modules.config.set, server.org, 'my-key', 'x'.repeat(1000000)),
      {
        message: 'Breached maximum config storage limit.'
      }
    );
  })
})
