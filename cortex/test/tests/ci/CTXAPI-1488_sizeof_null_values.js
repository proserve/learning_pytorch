const { roughSizeOfObject } = require('../../../lib/utils'),
      assert = require('assert')

describe('Issues - CTXAPI-1488 - Sizeof null values', function() {
  it('should be successfully calculate rough sizeof objects', function() {
    const tests = [
      // [test, expected]
      [null, 0],
      [undefined, 0],
      [{}, 0],
      [[], 0],
      [{ a: 1 }, 10],
      ['abc', 6],
      [{ a: 'a', b: false, c: 1 }, 20],
      [{ 'abc': true }, 10],
      [{
        a: 1, // 10
        b: null, // 2
        obj: { // 6
          a: { // 2
            b: { // 2
              c: { // 2
                d: null // 2
              }
            }
          }
        }
      }, 26]
    ]

    for (let [test, expected] of tests) {
      assert.strictEqual(roughSizeOfObject(test), expected)
    }
  })
})
