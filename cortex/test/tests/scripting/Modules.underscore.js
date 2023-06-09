'use strict'

/* eslint-disable */

const saSandboxed = require('../../lib/sandboxed-standalone'),
      path = require('path')

function sandboxed(main) {

  const fn = saSandboxed(
    main,
    {
      jspath: path.resolve(path.join(__dirname, '../../../lib/modules/sandbox/scripts/build/modules')),
      transpile: false
    }
  )
  return callback => {
    fn((err, result) => {
      if (err) {
        console.log(err)
      }
      callback(err, result)
    })
  }
}

describe('Scripting', function() {

  describe('Underscore', function() {

    it('Arrays', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('underscore')

      registerTests()

      var failures = []

      QUnit.testDone(function(details) {
        if (details.failed) {
          failures = failures.concat(details.assertions.filter(function(v) { return !v.result }).map(function(v) { return { name: details.module + '.' + details.name, message: v.message} }))
        }
      })

      QUnit.start()

      if (failures.length) {
        throw {
          code: 'kError',
          reason: '1 or more tests failed.',
          faults: failures
        }
      }

      function registerTests() {

        QUnit.module('Arrays')

        QUnit.test('first', function(assert) {
          assert.strictEqual(_.first([1, 2, 3]), 1, 'can pull out the first element of an array')
          assert.strictEqual(_([1, 2, 3]).first(), 1, 'can perform OO-style "first()"')
          assert.deepEqual(_.first([1, 2, 3], 0), [], 'returns an empty array when n <= 0 (0 case)')
          assert.deepEqual(_.first([1, 2, 3], -1), [], 'returns an empty array when n <= 0 (negative case)')
          assert.deepEqual(_.first([1, 2, 3], 2), [1, 2], 'can fetch the first n elements')
          assert.deepEqual(_.first([1, 2, 3], 5), [1, 2, 3], 'returns the whole array if n > length')
          var result = (function() { return _.first(arguments) }(4, 3, 2, 1))
          assert.strictEqual(result, 4, 'works on an arguments object')
          result = _.map([[1, 2, 3], [1, 2, 3]], _.first)
          assert.deepEqual(result, [1, 1], 'works well with _.map')
          assert.strictEqual(_.first(null), void 0, 'returns undefined when called on null')

          Array.prototype[0] = 'boo'
          assert.strictEqual(_.first([]), void 0, 'return undefined when called on a empty array')
          delete Array.prototype[0]
        })

        QUnit.test('head', function(assert) {
          assert.strictEqual(_.head, _.first, 'is an alias for first')
        })

        QUnit.test('take', function(assert) {
          assert.strictEqual(_.take, _.first, 'is an alias for first')
        })

        QUnit.test('rest', function(assert) {
          var numbers = [1, 2, 3, 4]
          assert.deepEqual(_.rest(numbers), [2, 3, 4], 'fetches all but the first element')
          assert.deepEqual(_.rest(numbers, 0), [1, 2, 3, 4], 'returns the whole array when index is 0')
          assert.deepEqual(_.rest(numbers, 2), [3, 4], 'returns elements starting at the given index')
          var result = (function() { return _(arguments).rest() }(1, 2, 3, 4))
          assert.deepEqual(result, [2, 3, 4], 'works on an arguments object')
          result = _.map([[1, 2, 3], [1, 2, 3]], _.rest)
          assert.deepEqual(_.flatten(result), [2, 3, 2, 3], 'works well with _.map')
        })

        QUnit.test('tail', function(assert) {
          assert.strictEqual(_.tail, _.rest, 'is an alias for rest')
        })

        QUnit.test('drop', function(assert) {
          assert.strictEqual(_.drop, _.rest, 'is an alias for rest')
        })

        QUnit.test('initial', function(assert) {
          assert.deepEqual(_.initial([1, 2, 3, 4, 5]), [1, 2, 3, 4], 'returns all but the last element')
          assert.deepEqual(_.initial([1, 2, 3, 4], 2), [1, 2], 'returns all but the last n elements')
          assert.deepEqual(_.initial([1, 2, 3, 4], 6), [], 'returns an empty array when n > length')
          var result = (function() { return _(arguments).initial() }(1, 2, 3, 4))
          assert.deepEqual(result, [1, 2, 3], 'works on an arguments object')
          result = _.map([[1, 2, 3], [1, 2, 3]], _.initial)
          assert.deepEqual(_.flatten(result), [1, 2, 1, 2], 'works well with _.map')
        })

        QUnit.test('last', function(assert) {
          assert.strictEqual(_.last([1, 2, 3]), 3, 'can pull out the last element of an array')
          assert.strictEqual(_([1, 2, 3]).last(), 3, 'can perform OO-style "last()"')
          assert.deepEqual(_.last([1, 2, 3], 0), [], 'returns an empty array when n <= 0 (0 case)')
          assert.deepEqual(_.last([1, 2, 3], -1), [], 'returns an empty array when n <= 0 (negative case)')
          assert.deepEqual(_.last([1, 2, 3], 2), [2, 3], 'can fetch the last n elements')
          assert.deepEqual(_.last([1, 2, 3], 5), [1, 2, 3], 'returns the whole array if n > length')
          var result = (function() { return _(arguments).last() }(1, 2, 3, 4))
          assert.strictEqual(result, 4, 'works on an arguments object')
          result = _.map([[1, 2, 3], [1, 2, 3]], _.last)
          assert.deepEqual(result, [3, 3], 'works well with _.map')
          assert.strictEqual(_.last(null), void 0, 'returns undefined when called on null')

          var arr = []
          arr[-1] = 'boo'
          assert.strictEqual(_.last(arr), void 0, 'return undefined when called on a empty array')
        })

        QUnit.test('compact', function(assert) {
          assert.deepEqual(_.compact([1, false, null, 0, '', void 0, NaN, 2]), [1, 2], 'removes all falsy values')
          var result = (function() { return _.compact(arguments) }(0, 1, false, 2, false, 3))
          assert.deepEqual(result, [1, 2, 3], 'works on an arguments object')
          result = _.map([[1, false, false], [false, false, 3]], _.compact)
          assert.deepEqual(result, [[1], [3]], 'works well with _.map')
        })

        QUnit.test('flatten', function(assert) {
          assert.deepEqual(_.flatten(null), [], 'supports null')
          assert.deepEqual(_.flatten(void 0), [], 'supports undefined')

          assert.deepEqual(_.flatten([[], [[]], []]), [], 'supports empty arrays')
          assert.deepEqual(_.flatten([[], [[]], []], true), [[]], 'can shallowly flatten empty arrays')

          var list = [1, [2], [3, [[[4]]]]]
          assert.deepEqual(_.flatten(list), [1, 2, 3, 4], 'can flatten nested arrays')
          assert.deepEqual(_.flatten(list, true), [1, 2, 3, [[[4]]]], 'can shallowly flatten nested arrays')
          var result = (function() { return _.flatten(arguments) }(1, [2], [3, [[[4]]]]))
          assert.deepEqual(result, [1, 2, 3, 4], 'works on an arguments object')
          list = [[1], [2], [3], [[4]]]
          assert.deepEqual(_.flatten(list, true), [1, 2, 3, [4]], 'can shallowly flatten arrays containing only other arrays')

          assert.strictEqual(_.flatten([_.range(10), _.range(10), 5, 1, 3], true).length, 23, 'can flatten medium length arrays')
          assert.strictEqual(_.flatten([_.range(10), _.range(10), 5, 1, 3]).length, 23, 'can shallowly flatten medium length arrays')
          assert.strictEqual(_.flatten([new Array(1000), _.range(5600), 5, 1, 3]).length, 6603, 'can handle large arrays')
          assert.strictEqual(_.flatten([new Array(1000), _.range(5600), 5, 1, 3], true).length, 6603, 'can handle large arrays in shallow mode')

        })

        QUnit.test('without', function(assert) {
          var list = [1, 2, 1, 0, 3, 1, 4]
          assert.deepEqual(_.without(list, 0, 1), [2, 3, 4], 'removes all instances of the given values')
          var result = (function() { return _.without(arguments, 0, 1) }(1, 2, 1, 0, 3, 1, 4))
          assert.deepEqual(result, [2, 3, 4], 'works on an arguments object')

          list = [{one: 1}, {two: 2}]
          assert.deepEqual(_.without(list, {one: 1}), list, 'compares objects by reference (value case)')
          assert.deepEqual(_.without(list, list[0]), [{two: 2}], 'compares objects by reference (reference case)')
        })

        QUnit.test('sortedIndex', function(assert) {
          var numbers = [10, 20, 30, 40, 50]
          var indexFor35 = _.sortedIndex(numbers, 35)
          assert.strictEqual(indexFor35, 3, 'finds the index at which a value should be inserted to retain order')
          var indexFor30 = _.sortedIndex(numbers, 30)
          assert.strictEqual(indexFor30, 2, 'finds the smallest index at which a value could be inserted to retain order')

          var objects = [{x: 10}, {x: 20}, {x: 30}, {x: 40}]
          var iterator = function(obj) { return obj.x }
          assert.strictEqual(_.sortedIndex(objects, {x: 25}, iterator), 2, 'uses the result of `iterator` for order comparisons')
          assert.strictEqual(_.sortedIndex(objects, {x: 35}, 'x'), 3, 'when `iterator` is a string, uses that key for order comparisons')

          var context = {1: 2, 2: 3, 3: 4}
          iterator = function(obj) { return this[obj] }
          assert.strictEqual(_.sortedIndex([1, 3], 2, iterator, context), 1, 'can execute its iterator in the given context')

          var values = [0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535, 131071, 262143, 524287,
            1048575, 2097151, 4194303, 8388607, 16777215, 33554431, 67108863, 134217727, 268435455, 536870911, 1073741823, 2147483647]
          var largeArray = Array(Math.pow(2, 32) - 1)
          var length = values.length
          // Sparsely populate `array`
          while (length--) {
            largeArray[values[length]] = values[length]
          }
          assert.strictEqual(_.sortedIndex(largeArray, 2147483648), 2147483648, 'works with large indexes')
        })

        QUnit.test('uniq', function(assert) {
          var list = [1, 2, 1, 3, 1, 4]
          assert.deepEqual(_.uniq(list), [1, 2, 3, 4], 'can find the unique values of an unsorted array')
          list = [1, 1, 1, 2, 2, 3]
          assert.deepEqual(_.uniq(list, true), [1, 2, 3], 'can find the unique values of a sorted array faster')

          list = [{name: 'Moe'}, {name: 'Curly'}, {name: 'Larry'}, {name: 'Curly'}]
          var expected = [{name: 'Moe'}, {name: 'Curly'}, {name: 'Larry'}]
          var iterator = function(stooge) { return stooge.name }
          assert.deepEqual(_.uniq(list, false, iterator), expected, 'uses the result of `iterator` for uniqueness comparisons (unsorted case)')
          assert.deepEqual(_.uniq(list, iterator), expected, '`sorted` argument defaults to false when omitted')
          assert.deepEqual(_.uniq(list, 'name'), expected, 'when `iterator` is a string, uses that key for comparisons (unsorted case)')

          list = [{score: 8}, {score: 10}, {score: 10}]
          expected = [{score: 8}, {score: 10}]
          iterator = function(item) { return item.score }
          assert.deepEqual(_.uniq(list, true, iterator), expected, 'uses the result of `iterator` for uniqueness comparisons (sorted case)')
          assert.deepEqual(_.uniq(list, true, 'score'), expected, 'when `iterator` is a string, uses that key for comparisons (sorted case)')

          assert.deepEqual(_.uniq([{0: 1}, {0: 1}, {0: 1}, {0: 2}], 0), [{0: 1}, {0: 2}], 'can use falsy pluck like iterator')

          var result = (function() { return _.uniq(arguments) }(1, 2, 1, 3, 1, 4))
          assert.deepEqual(result, [1, 2, 3, 4], 'works on an arguments object')

          var a = {}, b = {}, c = {}
          assert.deepEqual(_.uniq([a, b, a, b, c]), [a, b, c], 'works on values that can be tested for equivalency but not ordered')

          assert.deepEqual(_.uniq(null), [], 'returns an empty array when `array` is not iterable')

          var context = {}
          list = [3]
          _.uniq(list, function(value, index, array) {
            assert.strictEqual(this, context, 'executes its iterator in the given context')
            assert.strictEqual(value, 3, 'passes its iterator the value')
            assert.strictEqual(index, 0, 'passes its iterator the index')
            assert.strictEqual(array, list, 'passes its iterator the entire array')
          }, context)

        })

        QUnit.test('unique', function(assert) {
          assert.strictEqual(_.unique, _.uniq, 'is an alias for uniq')
        })

        QUnit.test('intersection', function(assert) {
          var stooges = ['moe', 'curly', 'larry'], leaders = ['moe', 'groucho']
          assert.deepEqual(_.intersection(stooges, leaders), ['moe'], 'can find the set intersection of two arrays')
          assert.deepEqual(_(stooges).intersection(leaders), ['moe'], 'can perform an OO-style intersection')
          var result = (function() { return _.intersection(arguments, leaders) }('moe', 'curly', 'larry'))
          assert.deepEqual(result, ['moe'], 'works on an arguments object')
          var theSixStooges = ['moe', 'moe', 'curly', 'curly', 'larry', 'larry']
          assert.deepEqual(_.intersection(theSixStooges, leaders), ['moe'], 'returns a duplicate-free array')
          result = _.intersection([2, 4, 3, 1], [1, 2, 3])
          assert.deepEqual(result, [2, 3, 1], 'preserves the order of the first array')
          result = _.intersection(null, [1, 2, 3])
          assert.deepEqual(result, [], 'returns an empty array when passed null as the first argument')
          result = _.intersection([1, 2, 3], null)
          assert.deepEqual(result, [], 'returns an empty array when passed null as an argument beyond the first')
        })

        QUnit.test('union', function(assert) {
          var result = _.union([1, 2, 3], [2, 30, 1], [1, 40])
          assert.deepEqual(result, [1, 2, 3, 30, 40], 'can find the union of a list of arrays')

          result = _([1, 2, 3]).union([2, 30, 1], [1, 40])
          assert.deepEqual(result, [1, 2, 3, 30, 40], 'can perform an OO-style union')

          result = _.union([1, 2, 3], [2, 30, 1], [1, 40, [1]])
          assert.deepEqual(result, [1, 2, 3, 30, 40, [1]], 'can find the union of a list of nested arrays')

          result = _.union([10, 20], [1, 30, 10], [0, 40])
          assert.deepEqual(result, [10, 20, 1, 30, 0, 40], 'orders values by their first encounter')

          result = (function() { return _.union(arguments, [2, 30, 1], [1, 40]) }(1, 2, 3))
          assert.deepEqual(result, [1, 2, 3, 30, 40], 'works on an arguments object')

          assert.deepEqual(_.union([1, 2, 3], 4), [1, 2, 3], 'restricts the union to arrays only')
        })

        QUnit.test('difference', function(assert) {
          var result = _.difference([1, 2, 3], [2, 30, 40])
          assert.deepEqual(result, [1, 3], 'can find the difference of two arrays')

          result = _([1, 2, 3]).difference([2, 30, 40])
          assert.deepEqual(result, [1, 3], 'can perform an OO-style difference')

          result = _.difference([1, 2, 3, 4], [2, 30, 40], [1, 11, 111])
          assert.deepEqual(result, [3, 4], 'can find the difference of three arrays')

          result = _.difference([8, 9, 3, 1], [3, 8])
          assert.deepEqual(result, [9, 1], 'preserves the order of the first array')

          result = (function() { return _.difference(arguments, [2, 30, 40]) }(1, 2, 3))
          assert.deepEqual(result, [1, 3], 'works on an arguments object')

          result = _.difference([1, 2, 3], 1)
          assert.deepEqual(result, [1, 2, 3], 'restrict the difference to arrays only')
        })

        QUnit.test('zip', function(assert) {
          var names = ['moe', 'larry', 'curly'], ages = [30, 40, 50], leaders = [true]
          assert.deepEqual(_.zip(names, ages, leaders), [
            ['moe', 30, true],
            ['larry', 40, void 0],
            ['curly', 50, void 0]
          ], 'zipped together arrays of different lengths')

          var stooges = _.zip(['moe', 30, 'stooge 1'], ['larry', 40, 'stooge 2'], ['curly', 50, 'stooge 3'])
          assert.deepEqual(stooges, [['moe', 'larry', 'curly'], [30, 40, 50], ['stooge 1', 'stooge 2', 'stooge 3']], 'zipped pairs')

          // In the case of different lengths of the tuples, undefined values
          // should be used as placeholder
          stooges = _.zip(['moe', 30], ['larry', 40], ['curly', 50, 'extra data'])
          assert.deepEqual(stooges, [['moe', 'larry', 'curly'], [30, 40, 50], [void 0, void 0, 'extra data']], 'zipped pairs with empties')

          var empty = _.zip([])
          assert.deepEqual(empty, [], 'unzipped empty')

          assert.deepEqual(_.zip(null), [], 'handles null')
          assert.deepEqual(_.zip(), [], '_.zip() returns []')
        })

        QUnit.test('unzip', function(assert) {
          assert.deepEqual(_.unzip(null), [], 'handles null')

          assert.deepEqual(_.unzip([['a', 'b'], [1, 2]]), [['a', 1], ['b', 2]])

          // complements zip
          var zipped = _.zip(['fred', 'barney'], [30, 40], [true, false])
          assert.deepEqual(_.unzip(zipped), [['fred', 'barney'], [30, 40], [true, false]])

          zipped = _.zip(['moe', 30], ['larry', 40], ['curly', 50, 'extra data'])
          assert.deepEqual(_.unzip(zipped), [['moe', 30, void 0], ['larry', 40, void 0], ['curly', 50, 'extra data']], 'Uses length of largest array')
        })

        QUnit.test('object', function(assert) {
          var result = _.object(['moe', 'larry', 'curly'], [30, 40, 50])
          var shouldBe = {moe: 30, larry: 40, curly: 50}
          assert.deepEqual(result, shouldBe, 'two arrays zipped together into an object')

          result = _.object([['one', 1], ['two', 2], ['three', 3]])
          shouldBe = {one: 1, two: 2, three: 3}
          assert.deepEqual(result, shouldBe, 'an array of pairs zipped together into an object')

          var stooges = {moe: 30, larry: 40, curly: 50}
          assert.deepEqual(_.object(_.pairs(stooges)), stooges, 'an object converted to pairs and back to an object')

          assert.deepEqual(_.object(null), {}, 'handles nulls')
        })

        QUnit.test('indexOf', function(assert) {
          var numbers = [1, 2, 3]
          assert.strictEqual(_.indexOf(numbers, 2), 1, 'can compute indexOf')
          var result = (function() { return _.indexOf(arguments, 2) }(1, 2, 3))
          assert.strictEqual(result, 1, 'works on an arguments object')

          _.each([null, void 0, [], false], function(val) {
            var msg = 'Handles: ' + (_.isArray(val) ? '[]' : val)
            assert.strictEqual(_.indexOf(val, 2), -1, msg)
            assert.strictEqual(_.indexOf(val, 2, -1), -1, msg)
            assert.strictEqual(_.indexOf(val, 2, -20), -1, msg)
            assert.strictEqual(_.indexOf(val, 2, 15), -1, msg)
          })

          var num = 35
          numbers = [10, 20, 30, 40, 50]
          var index = _.indexOf(numbers, num, true)
          assert.strictEqual(index, -1, '35 is not in the list')

          numbers = [10, 20, 30, 40, 50]; num = 40
          index = _.indexOf(numbers, num, true)
          assert.strictEqual(index, 3, '40 is in the list')

          numbers = [1, 40, 40, 40, 40, 40, 40, 40, 50, 60, 70]; num = 40
          assert.strictEqual(_.indexOf(numbers, num, true), 1, '40 is in the list')
          assert.strictEqual(_.indexOf(numbers, 6, true), -1, '6 isnt in the list')
          assert.strictEqual(_.indexOf([1, 2, 5, 4, 6, 7], 5, true), -1, 'sorted indexOf doesn\'t use binary search')
          assert.ok(_.every(['1', [], {}, null], function() {
            return _.indexOf(numbers, num, {}) === 1
          }), 'non-nums as fromIndex make indexOf assume sorted')

          numbers = [1, 2, 3, 1, 2, 3, 1, 2, 3]
          index = _.indexOf(numbers, 2, 5)
          assert.strictEqual(index, 7, 'supports the fromIndex argument')

          index = _.indexOf([,,, 0], void 0)
          assert.strictEqual(index, 0, 'treats sparse arrays as if they were dense')

          var array = [1, 2, 3, 1, 2, 3]
          assert.strictEqual(_.indexOf(array, 1, -3), 3, 'neg `fromIndex` starts at the right index')
          assert.strictEqual(_.indexOf(array, 1, -2), -1, 'neg `fromIndex` starts at the right index')
          assert.strictEqual(_.indexOf(array, 2, -3), 4)
          _.each([-6, -8, -Infinity], function(fromIndex) {
            assert.strictEqual(_.indexOf(array, 1, fromIndex), 0)
          })
          assert.strictEqual(_.indexOf([1, 2, 3], 1, true), 0)

          index = _.indexOf([], void 0, true)
          assert.strictEqual(index, -1, 'empty array with truthy `isSorted` returns -1')
        })

        QUnit.test('indexOf with NaN', function(assert) {
          assert.strictEqual(_.indexOf([1, 2, NaN, NaN], NaN), 2, 'Expected [1, 2, NaN] to contain NaN')
          assert.strictEqual(_.indexOf([1, 2, Infinity], NaN), -1, 'Expected [1, 2, NaN] to contain NaN')

          assert.strictEqual(_.indexOf([1, 2, NaN, NaN], NaN, 1), 2, 'startIndex does not affect result')
          assert.strictEqual(_.indexOf([1, 2, NaN, NaN], NaN, -2), 2, 'startIndex does not affect result');

          (function() {
            assert.strictEqual(_.indexOf(arguments, NaN), 2, 'Expected arguments [1, 2, NaN] to contain NaN')
          }(1, 2, NaN, NaN))
        })

        QUnit.test('indexOf with +- 0', function(assert) {
          _.each([-0, +0], function(val) {
            assert.strictEqual(_.indexOf([1, 2, val, val], val), 2)
            assert.strictEqual(_.indexOf([1, 2, val, val], -val), 2)
          })
        })

        QUnit.test('lastIndexOf', function(assert) {
          var numbers = [1, 0, 1]
          var falsy = [void 0, '', 0, false, NaN, null, void 0]
          assert.strictEqual(_.lastIndexOf(numbers, 1), 2)

          numbers = [1, 0, 1, 0, 0, 1, 0, 0, 0]
          numbers.lastIndexOf = null
          assert.strictEqual(_.lastIndexOf(numbers, 1), 5, 'can compute lastIndexOf, even without the native function')
          assert.strictEqual(_.lastIndexOf(numbers, 0), 8, 'lastIndexOf the other element')
          var result = (function() { return _.lastIndexOf(arguments, 1) }(1, 0, 1, 0, 0, 1, 0, 0, 0))
          assert.strictEqual(result, 5, 'works on an arguments object')

          _.each([null, void 0, [], false], function(val) {
            var msg = 'Handles: ' + (_.isArray(val) ? '[]' : val)
            assert.strictEqual(_.lastIndexOf(val, 2), -1, msg)
            assert.strictEqual(_.lastIndexOf(val, 2, -1), -1, msg)
            assert.strictEqual(_.lastIndexOf(val, 2, -20), -1, msg)
            assert.strictEqual(_.lastIndexOf(val, 2, 15), -1, msg)
          })

          numbers = [1, 2, 3, 1, 2, 3, 1, 2, 3]
          var index = _.lastIndexOf(numbers, 2, 2)
          assert.strictEqual(index, 1, 'supports the fromIndex argument')

          var array = [1, 2, 3, 1, 2, 3]

          assert.strictEqual(_.lastIndexOf(array, 1, 0), 0, 'starts at the correct from idx')
          assert.strictEqual(_.lastIndexOf(array, 3), 5, 'should return the index of the last matched value')
          assert.strictEqual(_.lastIndexOf(array, 4), -1, 'should return `-1` for an unmatched value')

          assert.strictEqual(_.lastIndexOf(array, 1, 2), 0, 'should work with a positive `fromIndex`')

          _.each([6, 8, Math.pow(2, 32), Infinity], function(fromIndex) {
            assert.strictEqual(_.lastIndexOf(array, void 0, fromIndex), -1)
            assert.strictEqual(_.lastIndexOf(array, 1, fromIndex), 3)
            assert.strictEqual(_.lastIndexOf(array, '', fromIndex), -1)
          })

          var expected = _.map(falsy, function(value) {
            return typeof value === 'number' ? -1 : 5
          })

          var actual = _.map(falsy, function(fromIndex) {
            return _.lastIndexOf(array, 3, fromIndex)
          })

          assert.deepEqual(actual, expected, 'should treat falsy `fromIndex` values, except `0` and `NaN`, as `array.length`')
          assert.strictEqual(_.lastIndexOf(array, 3, '1'), 5, 'should treat non-number `fromIndex` values as `array.length`')
          assert.strictEqual(_.lastIndexOf(array, 3, true), 5, 'should treat non-number `fromIndex` values as `array.length`')

          assert.strictEqual(_.lastIndexOf(array, 2, -3), 1, 'should work with a negative `fromIndex`')
          assert.strictEqual(_.lastIndexOf(array, 1, -3), 3, 'neg `fromIndex` starts at the right index')

          assert.deepEqual(_.map([-6, -8, -Infinity], function(fromIndex) {
            return _.lastIndexOf(array, 1, fromIndex)
          }), [0, -1, -1])
        })

        QUnit.test('lastIndexOf with NaN', function(assert) {
          assert.strictEqual(_.lastIndexOf([1, 2, NaN, NaN], NaN), 3, 'Expected [1, 2, NaN] to contain NaN')
          assert.strictEqual(_.lastIndexOf([1, 2, Infinity], NaN), -1, 'Expected [1, 2, NaN] to contain NaN')

          assert.strictEqual(_.lastIndexOf([1, 2, NaN, NaN], NaN, 2), 2, 'fromIndex does not affect result')
          assert.strictEqual(_.lastIndexOf([1, 2, NaN, NaN], NaN, -2), 2, 'fromIndex does not affect result');

          (function() {
            assert.strictEqual(_.lastIndexOf(arguments, NaN), 3, 'Expected arguments [1, 2, NaN] to contain NaN')
          }(1, 2, NaN, NaN))
        })

        QUnit.test('lastIndexOf with +- 0', function(assert) {
          _.each([-0, +0], function(val) {
            assert.strictEqual(_.lastIndexOf([1, 2, val, val], val), 3)
            assert.strictEqual(_.lastIndexOf([1, 2, val, val], -val), 3)
            assert.strictEqual(_.lastIndexOf([-1, 1, 2], -val), -1)
          })
        })

        QUnit.test('findIndex', function(assert) {
          var objects = [
            {a: 0, b: 0},
            {a: 1, b: 1},
            {a: 2, b: 2},
            {a: 0, b: 0}
          ]

          assert.strictEqual(_.findIndex(objects, function(obj) {
            return obj.a === 0
          }), 0)

          assert.strictEqual(_.findIndex(objects, function(obj) {
            return obj.b * obj.a === 4
          }), 2)

          assert.strictEqual(_.findIndex(objects, 'a'), 1, 'Uses lookupIterator')

          assert.strictEqual(_.findIndex(objects, function(obj) {
            return obj.b * obj.a === 5
          }), -1)

          assert.strictEqual(_.findIndex(null, _.noop), -1)
          assert.strictEqual(_.findIndex(objects, function(a) {
            return a.foo === null
          }), -1)
          _.findIndex([{a: 1}], function(a, key, obj) {
            assert.strictEqual(key, 0)
            assert.deepEqual(obj, [{a: 1}])
            assert.strictEqual(this, objects, 'called with context')
          }, objects)

          var sparse = []
          sparse[20] = {a: 2, b: 2}
          assert.strictEqual(_.findIndex(sparse, function(obj) {
            return obj && obj.b * obj.a === 4
          }), 20, 'Works with sparse arrays')

          var array = [1, 2, 3, 4]
          array.match = 55
          assert.strictEqual(_.findIndex(array, function(x) { return x === 55 }), -1, 'doesn\'t match array-likes keys')
        })

        QUnit.test('findLastIndex', function(assert) {
          var objects = [
            {a: 0, b: 0},
            {a: 1, b: 1},
            {a: 2, b: 2},
            {a: 0, b: 0}
          ]

          assert.strictEqual(_.findLastIndex(objects, function(obj) {
            return obj.a === 0
          }), 3)

          assert.strictEqual(_.findLastIndex(objects, function(obj) {
            return obj.b * obj.a === 4
          }), 2)

          assert.strictEqual(_.findLastIndex(objects, 'a'), 2, 'Uses lookupIterator')

          assert.strictEqual(_.findLastIndex(objects, function(obj) {
            return obj.b * obj.a === 5
          }), -1)

          assert.strictEqual(_.findLastIndex(null, _.noop), -1)
          assert.strictEqual(_.findLastIndex(objects, function(a) {
            return a.foo === null
          }), -1)
          _.findLastIndex([{a: 1}], function(a, key, obj) {
            assert.strictEqual(key, 0)
            assert.deepEqual(obj, [{a: 1}])
            assert.strictEqual(this, objects, 'called with context')
          }, objects)

          var sparse = []
          sparse[20] = {a: 2, b: 2}
          assert.strictEqual(_.findLastIndex(sparse, function(obj) {
            return obj && obj.b * obj.a === 4
          }), 20, 'Works with sparse arrays')

          var array = [1, 2, 3, 4]
          array.match = 55
          assert.strictEqual(_.findLastIndex(array, function(x) { return x === 55 }), -1, 'doesn\'t match array-likes keys')
        })

        QUnit.test('range', function(assert) {
          assert.deepEqual(_.range(0), [], 'range with 0 as a first argument generates an empty array')
          assert.deepEqual(_.range(4), [0, 1, 2, 3], 'range with a single positive argument generates an array of elements 0,1,2,...,n-1')
          assert.deepEqual(_.range(5, 8), [5, 6, 7], 'range with two arguments a &amp; b, a&lt;b generates an array of elements a,a+1,a+2,...,b-2,b-1')
          assert.deepEqual(_.range(3, 10, 3), [3, 6, 9], 'range with three arguments a &amp; b &amp; c, c &lt; b-a, a &lt; b generates an array of elements a,a+c,a+2c,...,b - (multiplier of a) &lt; c')
          assert.deepEqual(_.range(3, 10, 15), [3], 'range with three arguments a &amp; b &amp; c, c &gt; b-a, a &lt; b generates an array with a single element, equal to a')
          assert.deepEqual(_.range(12, 7, -2), [12, 10, 8], 'range with three arguments a &amp; b &amp; c, a &gt; b, c &lt; 0 generates an array of elements a,a-c,a-2c and ends with the number not less than b')
          assert.deepEqual(_.range(0, -10, -1), [0, -1, -2, -3, -4, -5, -6, -7, -8, -9], 'final example in the Python docs')
          assert.strictEqual(1 / _.range(-0, 1)[0], -Infinity, 'should preserve -0')
          assert.deepEqual(_.range(8, 5), [8, 7, 6], 'negative range generates descending array')
          assert.deepEqual(_.range(-3), [0, -1, -2], 'negative range generates descending array')
        })

        QUnit.test('chunk', function(assert) {
          assert.deepEqual(_.chunk([], 2), [], 'chunk for empty array returns an empty array')

          assert.deepEqual(_.chunk([1, 2, 3], 0), [], 'chunk into parts of 0 elements returns empty array')
          assert.deepEqual(_.chunk([1, 2, 3], -1), [], 'chunk into parts of negative amount of elements returns an empty array')
          assert.deepEqual(_.chunk([1, 2, 3]), [], 'defaults to empty array (chunk size 0)')

          assert.deepEqual(_.chunk([1, 2, 3], 1), [[1], [2], [3]], 'chunk into parts of 1 elements returns original array')

          assert.deepEqual(_.chunk([1, 2, 3], 3), [[1, 2, 3]], 'chunk into parts of current array length elements returns the original array')
          assert.deepEqual(_.chunk([1, 2, 3], 5), [[1, 2, 3]], 'chunk into parts of more then current array length elements returns the original array')

          assert.deepEqual(_.chunk([10, 20, 30, 40, 50, 60, 70], 2), [[10, 20], [30, 40], [50, 60], [70]], 'chunk into parts of less then current array length elements')
          assert.deepEqual(_.chunk([10, 20, 30, 40, 50, 60, 70], 3), [[10, 20, 30], [40, 50, 60], [70]], 'chunk into parts of less then current array length elements')
        })
      }

    }))

    it('Chaining', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('underscore')

      registerTests()

      var failures = []

      QUnit.testDone(function(details) {
        if (details.failed) {

        }
      })

      QUnit.start()

      if (failures.length) {
        throw {
          code: 'kError',
          reason: '1 or more tests failed.',
          faults: failures
        }
      }

      function registerTests() {

        QUnit.module('Chaining')

        QUnit.test('map/flatten/reduce', function(assert) {
          var lyrics = [
            'I\'m a lumberjack and I\'m okay',
            'I sleep all night and I work all day',
            'He\'s a lumberjack and he\'s okay',
            'He sleeps all night and he works all day'
          ]
          var counts = _(lyrics).chain()
            .map(function(line) { return line.split('') })
            .flatten()
            .reduce(function(hash, l) {
              hash[l] = hash[l] || 0
              hash[l]++
              return hash
            }, {})
            .value()
          assert.strictEqual(counts.a, 16, 'counted all the letters in the song')
          assert.strictEqual(counts.e, 10, 'counted all the letters in the song')
        })

        QUnit.test('select/reject/sortBy', function(assert) {
          var numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          numbers = _(numbers).chain().select(function(n) {
            return n % 2 === 0
          }).reject(function(n) {
            return n % 4 === 0
          }).sortBy(function(n) {
            return -n
          }).value()
          assert.deepEqual(numbers, [10, 6, 2], 'filtered and reversed the numbers')
        })

        QUnit.test('select/reject/sortBy in functional style', function(assert) {
          var numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          numbers = _.chain(numbers).select(function(n) {
            return n % 2 === 0
          }).reject(function(n) {
            return n % 4 === 0
          }).sortBy(function(n) {
            return -n
          }).value()
          assert.deepEqual(numbers, [10, 6, 2], 'filtered and reversed the numbers')
        })

        QUnit.test('reverse/concat/unshift/pop/map', function(assert) {
          var numbers = [1, 2, 3, 4, 5]
          numbers = _(numbers).chain()
            .reverse()
            .concat([5, 5, 5])
            .unshift(17)
            .pop()
            .map(function(n) { return n * 2 })
            .value()
          assert.deepEqual(numbers, [34, 10, 8, 6, 4, 2, 10, 10], 'can chain together array functions.')
        })

        QUnit.test('splice', function(assert) {
          var instance = _([1, 2, 3, 4, 5]).chain()
          assert.deepEqual(instance.splice(1, 3).value(), [1, 5])
          assert.deepEqual(instance.splice(1, 0).value(), [1, 5])
          assert.deepEqual(instance.splice(1, 1).value(), [1])
          assert.deepEqual(instance.splice(0, 1).value(), [], '#397 Can create empty array')
        })

        QUnit.test('shift', function(assert) {
          var instance = _([1, 2, 3]).chain()
          assert.deepEqual(instance.shift().value(), [2, 3])
          assert.deepEqual(instance.shift().value(), [3])
          assert.deepEqual(instance.shift().value(), [], '#397 Can create empty array')
        })

        QUnit.test('pop', function(assert) {
          var instance = _([1, 2, 3]).chain()
          assert.deepEqual(instance.pop().value(), [1, 2])
          assert.deepEqual(instance.pop().value(), [1])
          assert.deepEqual(instance.pop().value(), [], '#397 Can create empty array')
        })

        QUnit.test('chaining works in small stages', function(assert) {
          var o = _([1, 2, 3, 4]).chain()
          assert.deepEqual(o.filter(function(i) { return i < 3 }).value(), [1, 2])
          assert.deepEqual(o.filter(function(i) { return i > 2 }).value(), [3, 4])
        })

        QUnit.test('#1562: Engine proxies for chained functions', function(assert) {
          var wrapped = _(512)
          assert.strictEqual(wrapped.toJSON(), 512)
          assert.strictEqual(wrapped.valueOf(), 512)
          assert.strictEqual(+wrapped, 512)
          assert.strictEqual(wrapped.toString(), '512')
          assert.strictEqual('' + wrapped, '512')
        })

      }
    }))

    it('Collections', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('underscore')

      registerTests()

      var failures = []

      QUnit.testDone(function(details) {
        if (details.failed) {
          failures = failures.concat(details.assertions.filter(function(v) { return !v.result }).map(function(v) { return { name: details.module + '.' + details.name, message: v.message} }))
        }
      })

      QUnit.start()

      if (failures.length) {
        throw {
          code: 'kError',
          reason: '1 or more tests failed.',
          faults: failures
        }
      }

      function registerTests() {
        QUnit.module('Collections')

        QUnit.test('each', function(assert) {
          _.each([1, 2, 3], function(num, i) {
            assert.strictEqual(num, i + 1, 'each iterators provide value and iteration count')
          })

          var answers = []
          _.each([1, 2, 3], function(num) { answers.push(num * this.multiplier) }, {multiplier: 5})
          assert.deepEqual(answers, [5, 10, 15], 'context object property accessed')

          answers = []
          _.each([1, 2, 3], function(num) { answers.push(num) })
          assert.deepEqual(answers, [1, 2, 3], 'can iterate a simple array')

          answers = []
          var obj = {one: 1, two: 2, three: 3}
          obj.constructor.prototype.four = 4
          _.each(obj, function(value, key) { answers.push(key) })
          assert.deepEqual(answers, ['one', 'two', 'three'], 'iterating over objects works, and ignores the object prototype.')
          delete obj.constructor.prototype.four

          // ensure the each function is JITed
          _(100).times(function() { _.each([], function() {}) })
          var count = 0
          obj = {1: 'foo', 2: 'bar', 3: 'baz'}
          _.each(obj, function() { count++ })
          assert.strictEqual(count, 3, 'the fun should be called only 3 times')

          var answer = null
          _.each([1, 2, 3], function(num, index, arr) { if (_.include(arr, num)) answer = true })
          assert.ok(answer, 'can reference the original collection from inside the iterator')

          answers = 0
          _.each(null, function() { ++answers })
          assert.strictEqual(answers, 0, 'handles a null properly')

          _.each(false, function() {})

          var a = [1, 2, 3]
          assert.strictEqual(_.each(a, function() {}), a)
          assert.strictEqual(_.each(null, function() {}), null)
        })

        QUnit.test('forEach', function(assert) {
          assert.strictEqual(_.forEach, _.each, 'is an alias for each')
        })

        QUnit.test('lookupIterator with contexts', function(assert) {
          _.each([true, false, 'yes', '', 0, 1, {}], function(context) {
            _.each([1], function() {
              // assert.strictEqual(typeof this, 'object', 'context is a wrapped primitive');
              assert.strictEqual(this.valueOf(), context, 'the unwrapped context is the specified primitive')
              assert.equal(this, context, 'context can be coerced to the specified primitive')
            }, context)
          })
        })

        QUnit.test('Iterating objects with sketchy length properties', function(assert) {
          var functions = [
            'each', 'map', 'filter', 'find',
            'some', 'every', 'max', 'min',
            'groupBy', 'countBy', 'partition', 'indexBy'
          ]
          var reducers = ['reduce', 'reduceRight']

          var tricks = [
            {length: '5'},
            {length: {valueOf: _.constant(5)}},
            {length: Math.pow(2, 53) + 1},
            {length: Math.pow(2, 53)},
            {length: null},
            {length: -2},
            {length: new Number(15)}
          ]

          assert.expect(tricks.length * (functions.length + reducers.length + 4))

          _.each(tricks, function(trick) {
            var length = trick.length
            assert.strictEqual(_.size(trick), 1, 'size on obj with length: ' + length)
            assert.deepEqual(_.toArray(trick), [length], 'toArray on obj with length: ' + length)
            assert.deepEqual(_.shuffle(trick), [length], 'shuffle on obj with length: ' + length)
            assert.deepEqual(_.sample(trick), length, 'sample on obj with length: ' + length)

            _.each(functions, function(method) {
              _[method](trick, function(val, key) {
                assert.strictEqual(key, 'length', method + ': ran with length = ' + val)
              })
            })

            _.each(reducers, function(method) {
              assert.strictEqual(_[method](trick), trick.length, method)
            })
          })
        })

        QUnit.test('Resistant to collection length and properties changing while iterating', function(assert) {

          var collection = [
            'each', 'map', 'filter', 'find',
            'some', 'every', 'max', 'min', 'reject',
            'groupBy', 'countBy', 'partition', 'indexBy',
            'reduce', 'reduceRight'
          ]
          var array = [
            'findIndex', 'findLastIndex'
          ]
          var object = [
            'mapObject', 'findKey', 'pick', 'omit'
          ]

          _.each(collection.concat(array), function(method) {
            var sparseArray = [1, 2, 3]
            sparseArray.length = 100
            var answers = 0
            _[method](sparseArray, function() {
              ++answers
              return method === 'every' ? true : null
            }, {})
            assert.strictEqual(answers, 100, method + ' enumerates [0, length)')

            var growingCollection = [1, 2, 3], count = 0
            _[method](growingCollection, function() {
              if (count < 10) growingCollection.push(count++)
              return method === 'every' ? true : null
            }, {})
            assert.strictEqual(count, 3, method + ' is resistant to length changes')
          })

          _.each(collection.concat(object), function(method) {
            var changingObject = {0: 0, 1: 1}, count = 0
            _[method](changingObject, function(val) {
              if (count < 10) changingObject[++count] = val + 1
              return method === 'every' ? true : null
            }, {})

            assert.strictEqual(count, 2, method + ' is resistant to property changes')
          })
        })

        QUnit.test('map', function(assert) {
          var doubled = _.map([1, 2, 3], function(num) { return num * 2 })
          assert.deepEqual(doubled, [2, 4, 6], 'doubled numbers')

          var tripled = _.map([1, 2, 3], function(num) { return num * this.multiplier }, {multiplier: 3})
          assert.deepEqual(tripled, [3, 6, 9], 'tripled numbers with context')

          doubled = _([1, 2, 3]).map(function(num) { return num * 2 })
          assert.deepEqual(doubled, [2, 4, 6], 'OO-style doubled numbers')

          var ids = _.map({length: 2, 0: {id: '1'}, 1: {id: '2'}}, function(n) {
            return n.id
          })
          assert.deepEqual(ids, ['1', '2'], 'Can use collection methods on Array-likes.')

          assert.deepEqual(_.map(null, _.noop), [], 'handles a null properly')

          assert.deepEqual(_.map([1], function() {
            return this.length
          }, [5]), [1], 'called with context')

          // Passing a property name like _.pluck.
          var people = [{name: 'moe', age: 30}, {name: 'curly', age: 50}]
          assert.deepEqual(_.map(people, 'name'), ['moe', 'curly'], 'predicate string map to object properties')
        })

        QUnit.test('collect', function(assert) {
          assert.strictEqual(_.collect, _.map, 'is an alias for map')
        })

        QUnit.test('reduce', function(assert) {
          var sum = _.reduce([1, 2, 3], function(memo, num) { return memo + num }, 0)
          assert.strictEqual(sum, 6, 'can sum up an array')

          var context = {multiplier: 3}
          sum = _.reduce([1, 2, 3], function(memo, num) { return memo + num * this.multiplier }, 0, context)
          assert.strictEqual(sum, 18, 'can reduce with a context object')

          sum = _([1, 2, 3]).reduce(function(memo, num) { return memo + num }, 0)
          assert.strictEqual(sum, 6, 'OO-style reduce')

          sum = _.reduce([1, 2, 3], function(memo, num) { return memo + num })
          assert.strictEqual(sum, 6, 'default initial value')

          var prod = _.reduce([1, 2, 3, 4], function(memo, num) { return memo * num })
          assert.strictEqual(prod, 24, 'can reduce via multiplication')

          assert.strictEqual(_.reduce(null, _.noop, 138), 138, 'handles a null (with initial value) properly')
          assert.strictEqual(_.reduce([], _.noop, void 0), void 0, 'undefined can be passed as a special case')
          assert.strictEqual(_.reduce([_], _.noop), _, 'collection of length one with no initial value returns the first item')
          assert.strictEqual(_.reduce([], _.noop), void 0, 'returns undefined when collection is empty and no initial value')
        })

        QUnit.test('foldl', function(assert) {
          assert.strictEqual(_.foldl, _.reduce, 'is an alias for reduce')
        })

        QUnit.test('inject', function(assert) {
          assert.strictEqual(_.inject, _.reduce, 'is an alias for reduce')
        })

        QUnit.test('reduceRight', function(assert) {
          var list = _.reduceRight(['foo', 'bar', 'baz'], function(memo, str) { return memo + str }, '')
          assert.strictEqual(list, 'bazbarfoo', 'can perform right folds')

          list = _.reduceRight(['foo', 'bar', 'baz'], function(memo, str) { return memo + str })
          assert.strictEqual(list, 'bazbarfoo', 'default initial value')

          var sum = _.reduceRight({a: 1, b: 2, c: 3}, function(memo, num) { return memo + num })
          assert.strictEqual(sum, 6, 'default initial value on object')

          assert.strictEqual(_.reduceRight(null, _.noop, 138), 138, 'handles a null (with initial value) properly')
          assert.strictEqual(_.reduceRight([_], _.noop), _, 'collection of length one with no initial value returns the first item')

          assert.strictEqual(_.reduceRight([], _.noop, void 0), void 0, 'undefined can be passed as a special case')
          assert.strictEqual(_.reduceRight([], _.noop), void 0, 'returns undefined when collection is empty and no initial value')

          // Assert that the correct arguments are being passed.

          var args,
              init = {},
              object = {a: 1, b: 2},
              lastKey = _.keys(object).pop()

          var expected = lastKey === 'a'
            ? [init, 1, 'a', object]
            : [init, 2, 'b', object]

          _.reduceRight(object, function() {
            if (!args) args = _.toArray(arguments)
          }, init)

          assert.deepEqual(args, expected)

          // And again, with numeric keys.

          object = {2: 'a', 1: 'b'}
          lastKey = _.keys(object).pop()
          args = null

          expected = lastKey === '2'
            ? [init, 'a', '2', object]
            : [init, 'b', '1', object]

          _.reduceRight(object, function() {
            if (!args) args = _.toArray(arguments)
          }, init)

          assert.deepEqual(args, expected)
        })

        QUnit.test('foldr', function(assert) {
          assert.strictEqual(_.foldr, _.reduceRight, 'is an alias for reduceRight')
        })

        QUnit.test('find', function(assert) {
          var array = [1, 2, 3, 4]
          assert.strictEqual(_.find(array, function(n) { return n > 2 }), 3, 'should return first found `value`')
          assert.strictEqual(_.find(array, function() { return false }), void 0, 'should return `undefined` if `value` is not found')

          array.dontmatch = 55
          assert.strictEqual(_.find(array, function(x) { return x === 55 }), void 0, 'iterates array-likes correctly')

          // Matching an object like _.findWhere.
          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}, {a: 2, b: 4}]
          assert.deepEqual(_.find(list, {a: 1}), {a: 1, b: 2}, 'can be used as findWhere')
          assert.deepEqual(_.find(list, {b: 4}), {a: 1, b: 4})
          assert.notOk(_.find(list, {c: 1}), 'undefined when not found')
          assert.notOk(_.find([], {c: 1}), 'undefined when searching empty list')

          var result = _.find([1, 2, 3], function(num) { return num * 2 === 4 })
          assert.strictEqual(result, 2, 'found the first "2" and broke the loop')

          var obj = {
            a: {x: 1, z: 3},
            b: {x: 2, z: 2},
            c: {x: 3, z: 4},
            d: {x: 4, z: 1}
          }

          assert.deepEqual(_.find(obj, {x: 2}), {x: 2, z: 2}, 'works on objects')
          assert.deepEqual(_.find(obj, {x: 2, z: 1}), void 0)
          assert.deepEqual(_.find(obj, function(x) {
            return x.x === 4
          }), {x: 4, z: 1})

          _.findIndex([{a: 1}], function(a, key, o) {
            assert.strictEqual(key, 0)
            assert.deepEqual(o, [{a: 1}])
            assert.strictEqual(this, _, 'called with context')
          }, _)
        })

        QUnit.test('detect', function(assert) {
          assert.strictEqual(_.detect, _.find, 'is an alias for find')
        })

        QUnit.test('filter', function(assert) {
          var evenArray = [1, 2, 3, 4, 5, 6]
          var evenObject = {one: 1, two: 2, three: 3}
          var isEven = function(num) { return num % 2 === 0 }

          assert.deepEqual(_.filter(evenArray, isEven), [2, 4, 6])
          assert.deepEqual(_.filter(evenObject, isEven), [2], 'can filter objects')
          assert.deepEqual(_.filter([{}, evenObject, []], 'two'), [evenObject], 'predicate string map to object properties')

          _.filter([1], function() {
            assert.strictEqual(this, evenObject, 'given context')
          }, evenObject)

          // Can be used like _.where.
          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}]
          assert.deepEqual(_.filter(list, {a: 1}), [{a: 1, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}])
          assert.deepEqual(_.filter(list, {b: 2}), [{a: 1, b: 2}, {a: 2, b: 2}])
          assert.deepEqual(_.filter(list, {}), list, 'Empty object accepts all items')
          assert.deepEqual(_(list).filter({}), list, 'OO-filter')
        })

        QUnit.test('select', function(assert) {
          assert.strictEqual(_.select, _.filter, 'is an alias for filter')
        })

        QUnit.test('reject', function(assert) {
          var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 === 0 })
          assert.deepEqual(odds, [1, 3, 5], 'rejected each even number')

          var context = 'obj'

          var evens = _.reject([1, 2, 3, 4, 5, 6], function(num) {
            assert.strictEqual(context, 'obj')
            return num % 2 !== 0
          }, context)
          assert.deepEqual(evens, [2, 4, 6], 'rejected each odd number')

          assert.deepEqual(_.reject([odds, {one: 1, two: 2, three: 3}], 'two'), [odds], 'predicate string map to object properties')

          // Can be used like _.where.
          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}]
          assert.deepEqual(_.reject(list, {a: 1}), [{a: 2, b: 2}])
          assert.deepEqual(_.reject(list, {b: 2}), [{a: 1, b: 3}, {a: 1, b: 4}])
          assert.deepEqual(_.reject(list, {}), [], 'Returns empty list given empty object')
        })

        QUnit.test('every', function(assert) {
          assert.ok(_.every([], _.identity), 'the empty set')
          assert.ok(_.every([true, true, true], _.identity), 'every true values')
          assert.notOk(_.every([true, false, true], _.identity), 'one false value')
          assert.ok(_.every([0, 10, 28], function(num) { return num % 2 === 0 }), 'even numbers')
          assert.notOk(_.every([0, 11, 28], function(num) { return num % 2 === 0 }), 'an odd number')
          assert.strictEqual(_.every([1], _.identity), true, 'cast to boolean - true')
          assert.strictEqual(_.every([0], _.identity), false, 'cast to boolean - false')
          assert.notOk(_.every([void 0, void 0, void 0], _.identity), 'works with arrays of undefined')

          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}]
          assert.notOk(_.every(list, {a: 1, b: 2}), 'Can be called with object')
          assert.ok(_.every(list, 'a'), 'String mapped to object property')

          list = [{a: 1, b: 2}, {a: 2, b: 2, c: true}]
          assert.ok(_.every(list, {b: 2}), 'Can be called with object')
          assert.notOk(_.every(list, 'c'), 'String mapped to object property')

          assert.ok(_.every({a: 1, b: 2, c: 3, d: 4}, _.isNumber), 'takes objects')
          assert.notOk(_.every({a: 1, b: 2, c: 3, d: 4}, _.isObject), 'takes objects')
          assert.ok(_.every(['a', 'b', 'c', 'd'], _.hasOwnProperty, {a: 1, b: 2, c: 3, d: 4}), 'context works')
          assert.notOk(_.every(['a', 'b', 'c', 'd', 'f'], _.hasOwnProperty, {a: 1, b: 2, c: 3, d: 4}), 'context works')
        })

        QUnit.test('all', function(assert) {
          assert.strictEqual(_.all, _.every, 'is an alias for every')
        })

        QUnit.test('some', function(assert) {
          assert.notOk(_.some([]), 'the empty set')
          assert.notOk(_.some([false, false, false]), 'all false values')
          assert.ok(_.some([false, false, true]), 'one true value')
          assert.ok(_.some([null, 0, 'yes', false]), 'a string')
          assert.notOk(_.some([null, 0, '', false]), 'falsy values')
          assert.notOk(_.some([1, 11, 29], function(num) { return num % 2 === 0 }), 'all odd numbers')
          assert.ok(_.some([1, 10, 29], function(num) { return num % 2 === 0 }), 'an even number')
          assert.strictEqual(_.some([1], _.identity), true, 'cast to boolean - true')
          assert.strictEqual(_.some([0], _.identity), false, 'cast to boolean - false')
          assert.ok(_.some([false, false, true]))

          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}]
          assert.notOk(_.some(list, {a: 5, b: 2}), 'Can be called with object')
          assert.ok(_.some(list, 'a'), 'String mapped to object property')

          list = [{a: 1, b: 2}, {a: 2, b: 2, c: true}]
          assert.ok(_.some(list, {b: 2}), 'Can be called with object')
          assert.notOk(_.some(list, 'd'), 'String mapped to object property')

          assert.ok(_.some({a: '1', b: '2', c: '3', d: '4', e: 6}, _.isNumber), 'takes objects')
          assert.notOk(_.some({a: 1, b: 2, c: 3, d: 4}, _.isObject), 'takes objects')
          assert.ok(_.some(['a', 'b', 'c', 'd'], _.hasOwnProperty, {a: 1, b: 2, c: 3, d: 4}), 'context works')
          assert.notOk(_.some(['x', 'y', 'z'], _.hasOwnProperty, {a: 1, b: 2, c: 3, d: 4}), 'context works')
        })

        QUnit.test('any', function(assert) {
          assert.strictEqual(_.any, _.some, 'is an alias for some')
        })

        QUnit.test('includes', function(assert) {
          _.each([null, void 0, 0, 1, NaN, {}, []], function(val) {
            assert.strictEqual(_.includes(val, 'hasOwnProperty'), false)
          })
          assert.strictEqual(_.includes([1, 2, 3], 2), true, 'two is in the array')
          assert.notOk(_.includes([1, 3, 9], 2), 'two is not in the array')

          assert.strictEqual(_.includes([5, 4, 3, 2, 1], 5, true), true, 'doesn\'t delegate to binary search')

          assert.strictEqual(_.includes({moe: 1, larry: 3, curly: 9}, 3), true, '_.includes on objects checks their values')
          assert.ok(_([1, 2, 3]).includes(2), 'OO-style includes')

          var numbers = [1, 2, 3, 1, 2, 3, 1, 2, 3]
          assert.strictEqual(_.includes(numbers, 1, 1), true, 'takes a fromIndex')
          assert.strictEqual(_.includes(numbers, 1, -1), false, 'takes a fromIndex')
          assert.strictEqual(_.includes(numbers, 1, -2), false, 'takes a fromIndex')
          assert.strictEqual(_.includes(numbers, 1, -3), true, 'takes a fromIndex')
          assert.strictEqual(_.includes(numbers, 1, 6), true, 'takes a fromIndex')
          assert.strictEqual(_.includes(numbers, 1, 7), false, 'takes a fromIndex')

          assert.ok(_.every([1, 2, 3], _.partial(_.includes, numbers)), 'fromIndex is guarded')
        })

        QUnit.test('include', function(assert) {
          assert.strictEqual(_.include, _.includes, 'is an alias for includes')
        })

        QUnit.test('contains', function(assert) {
          assert.strictEqual(_.contains, _.includes, 'is an alias for includes')

        })

        QUnit.test('includes with NaN', function(assert) {
          assert.strictEqual(_.includes([1, 2, NaN, NaN], NaN), true, 'Expected [1, 2, NaN] to contain NaN')
          assert.strictEqual(_.includes([1, 2, Infinity], NaN), false, 'Expected [1, 2, NaN] to contain NaN')
        })

        QUnit.test('includes with +- 0', function(assert) {
          _.each([-0, +0], function(val) {
            assert.strictEqual(_.includes([1, 2, val, val], val), true)
            assert.strictEqual(_.includes([1, 2, val, val], -val), true)
            assert.strictEqual(_.includes([-1, 1, 2], -val), false)
          })
        })

        QUnit.test('invoke', function(assert) {
          assert.expect(13)
          var list = [[5, 1, 7], [3, 2, 1]]
          var result = _.invoke(list, 'sort')
          assert.deepEqual(result[0], [1, 5, 7], 'first array sorted')
          assert.deepEqual(result[1], [1, 2, 3], 'second array sorted')

          _.invoke([{
            method: function() {
              assert.deepEqual(_.toArray(arguments), [1, 2, 3], 'called with arguments')
            }
          }], 'method', 1, 2, 3)

          assert.deepEqual(_.invoke([{a: null}, {}, {a: _.constant(1)}], 'a'), [null, void 0, 1], 'handles null & undefined')

          assert.raises(function() {
            _.invoke([{a: 1}], 'a')
          }, TypeError, 'throws for non-functions')

          var getFoo = _.constant('foo')
          var getThis = function() { return this }
          var item = {
            a: {
              b: getFoo,
              c: getThis,
              d: null
            },
            e: getFoo,
            f: getThis,
            g: function() {
              return {
                h: getFoo
              }
            }
          }
          var arr = [item]
          assert.deepEqual(_.invoke(arr, ['a', 'b']), ['foo'], 'supports deep method access via an array syntax')
          assert.deepEqual(_.invoke(arr, ['a', 'c']), [item.a], 'executes deep methods on their direct parent')
          assert.deepEqual(_.invoke(arr, ['a', 'd', 'z']), [void 0], 'does not try to access attributes of non-objects')
          assert.deepEqual(_.invoke(arr, ['a', 'd']), [null], 'handles deep null values')
          assert.deepEqual(_.invoke(arr, ['e']), ['foo'], 'handles path arrays of length one')
          assert.deepEqual(_.invoke(arr, ['f']), [item], 'correct uses parent context with shallow array syntax')
          assert.deepEqual(_.invoke(arr, ['g', 'h']), [void 0], 'does not execute intermediate functions')

          arr = [{
            a: function() { return 'foo' }
          }, {
            a: function() { return 'bar' }
          }]
          assert.deepEqual(_.invoke(arr, 'a'), ['foo', 'bar'], 'can handle different methods on subsequent objects')
        })

        QUnit.test('invoke w/ function reference', function(assert) {
          var list = [[5, 1, 7], [3, 2, 1]]
          var result = _.invoke(list, Array.prototype.sort)
          assert.deepEqual(result[0], [1, 5, 7], 'first array sorted')
          assert.deepEqual(result[1], [1, 2, 3], 'second array sorted')

          assert.deepEqual(_.invoke([1, 2, 3], function(a) {
            return a + this
          }, 5), [6, 7, 8], 'receives params from invoke')
        })

        // Relevant when using ClojureScript
        QUnit.test('invoke when strings have a call method', function(assert) {
          String.prototype.call = function() {
            return 42
          }
          var list = [[5, 1, 7], [3, 2, 1]]
          var s = 'foo'
          assert.strictEqual(s.call(), 42, 'call function exists')
          var result = _.invoke(list, 'sort')
          assert.deepEqual(result[0], [1, 5, 7], 'first array sorted')
          assert.deepEqual(result[1], [1, 2, 3], 'second array sorted')
          delete String.prototype.call
          assert.strictEqual(s.call, void 0, 'call function removed')
        })

        QUnit.test('pluck', function(assert) {
          var people = [{name: 'moe', age: 30}, {name: 'curly', age: 50}]
          assert.deepEqual(_.pluck(people, 'name'), ['moe', 'curly'], 'pulls names out of objects')
          assert.deepEqual(_.pluck(people, 'address'), [void 0, void 0], 'missing properties are returned as undefined')
          // compat: most flexible handling of edge cases
          assert.deepEqual(_.pluck([{'[object Object]': 1}], {}), [1])
        })

        QUnit.test('where', function(assert) {
          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}]
          var result = _.where(list, {a: 1})
          assert.strictEqual(result.length, 3)
          assert.strictEqual(result[result.length - 1].b, 4)
          result = _.where(list, {b: 2})
          assert.strictEqual(result.length, 2)
          assert.strictEqual(result[0].a, 1)
          result = _.where(list, {})
          assert.strictEqual(result.length, list.length)

          function test() {}
          test.map = _.map
          assert.deepEqual(_.where([_, {a: 1, b: 2}, _], test), [_, _], 'checks properties given function')
        })

        QUnit.test('findWhere', function(assert) {
          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}, {a: 2, b: 4}]
          var result = _.findWhere(list, {a: 1})
          assert.deepEqual(result, {a: 1, b: 2})
          result = _.findWhere(list, {b: 4})
          assert.deepEqual(result, {a: 1, b: 4})

          result = _.findWhere(list, {c: 1})
          assert.ok(_.isUndefined(result), 'undefined when not found')

          result = _.findWhere([], {c: 1})
          assert.ok(_.isUndefined(result), 'undefined when searching empty list')

          function test() {}
          test.map = _.map
          assert.strictEqual(_.findWhere([_, {a: 1, b: 2}, _], test), _, 'checks properties given function')

          function TestClass() {
            this.y = 5
            this.x = 'foo'
          }
          var expect = {c: 1, x: 'foo', y: 5}
          assert.deepEqual(_.findWhere([{y: 5, b: 6}, expect], new TestClass()), expect, 'uses class instance properties')
        })

        QUnit.test('max', function(assert) {
          assert.strictEqual(-Infinity, _.max(null), 'can handle null/undefined')
          assert.strictEqual(-Infinity, _.max(void 0), 'can handle null/undefined')
          assert.strictEqual(-Infinity, _.max(null, _.identity), 'can handle null/undefined')

          assert.strictEqual(_.max([1, 2, 3]), 3, 'can perform a regular Math.max')

          var neg = _.max([1, 2, 3], function(num) { return -num })
          assert.strictEqual(neg, 1, 'can perform a computation-based max')

          assert.strictEqual(-Infinity, _.max({}), 'Maximum value of an empty object')
          assert.strictEqual(-Infinity, _.max([]), 'Maximum value of an empty array')
          assert.strictEqual(_.max({a: 'a'}), -Infinity, 'Maximum value of a non-numeric collection')

          assert.strictEqual(_.max(_.range(1, 3000)), 2999, 'Maximum value of a big array')

          assert.strictEqual(_.max([1, 2, 3, 'test']), 3, 'Finds correct max in array starting with num and containing a NaN')
          assert.strictEqual(_.max(['test', 1, 2, 3]), 3, 'Finds correct max in array starting with NaN')

          assert.strictEqual(_.max([1, 2, 3, null]), 3, 'Finds correct max in array starting with num and containing a `null`')
          assert.strictEqual(_.max([null, 1, 2, 3]), 3, 'Finds correct max in array starting with a `null`')

          assert.strictEqual(_.max([1, 2, 3, '']), 3, 'Finds correct max in array starting with num and containing an empty string')
          assert.strictEqual(_.max(['', 1, 2, 3]), 3, 'Finds correct max in array starting with an empty string')

          assert.strictEqual(_.max([1, 2, 3, false]), 3, 'Finds correct max in array starting with num and containing a false')
          assert.strictEqual(_.max([false, 1, 2, 3]), 3, 'Finds correct max in array starting with a false')

          assert.strictEqual(_.max([0, 1, 2, 3, 4]), 4, 'Finds correct max in array containing a zero')
          assert.strictEqual(_.max([-3, -2, -1, 0]), 0, 'Finds correct max in array containing negative numbers')

          assert.deepEqual(_.map([[1, 2, 3], [4, 5, 6]], _.max), [3, 6], 'Finds correct max in array when mapping through multiple arrays')

          var a = {x: -Infinity}
          var b = {x: -Infinity}
          var iterator = function(o) { return o.x }
          assert.strictEqual(_.max([a, b], iterator), a, 'Respects iterator return value of -Infinity')

          assert.deepEqual(_.max([{a: 1}, {a: 0, b: 3}, {a: 4}, {a: 2}], 'a'), {a: 4}, 'String keys use property iterator')

          assert.deepEqual(_.max([0, 2], function(c) { return c * this.x }, {x: 1}), 2, 'Iterator context')
          assert.deepEqual(_.max([[1], [2, 3], [-1, 4], [5]], 0), [5], 'Lookup falsy iterator')
          assert.deepEqual(_.max([{0: 1}, {0: 2}, {0: -1}, {a: 1}], 0), {0: 2}, 'Lookup falsy iterator')
        })

        QUnit.test('min', function(assert) {
          assert.strictEqual(_.min(null), Infinity, 'can handle null/undefined')
          assert.strictEqual(_.min(void 0), Infinity, 'can handle null/undefined')
          assert.strictEqual(_.min(null, _.identity), Infinity, 'can handle null/undefined')

          assert.strictEqual(_.min([1, 2, 3]), 1, 'can perform a regular Math.min')

          var neg = _.min([1, 2, 3], function(num) { return -num })
          assert.strictEqual(neg, 3, 'can perform a computation-based min')

          assert.strictEqual(_.min({}), Infinity, 'Minimum value of an empty object')
          assert.strictEqual(_.min([]), Infinity, 'Minimum value of an empty array')
          assert.strictEqual(_.min({a: 'a'}), Infinity, 'Minimum value of a non-numeric collection')

          assert.deepEqual(_.map([[1, 2, 3], [4, 5, 6]], _.min), [1, 4], 'Finds correct min in array when mapping through multiple arrays')

          var now = new Date(9999999999)
          var then = new Date(0)
          assert.strictEqual(_.min([now, then]), then)

          assert.strictEqual(_.min(_.range(1, 3000)), 1, 'Minimum value of a big array')

          assert.strictEqual(_.min([1, 2, 3, 'test']), 1, 'Finds correct min in array starting with num and containing a NaN')
          assert.strictEqual(_.min(['test', 1, 2, 3]), 1, 'Finds correct min in array starting with NaN')

          assert.strictEqual(_.min([1, 2, 3, null]), 1, 'Finds correct min in array starting with num and containing a `null`')
          assert.strictEqual(_.min([null, 1, 2, 3]), 1, 'Finds correct min in array starting with a `null`')

          assert.strictEqual(_.min([0, 1, 2, 3, 4]), 0, 'Finds correct min in array containing a zero')
          assert.strictEqual(_.min([-3, -2, -1, 0]), -3, 'Finds correct min in array containing negative numbers')

          var a = {x: Infinity}
          var b = {x: Infinity}
          var iterator = function(o) { return o.x }
          assert.strictEqual(_.min([a, b], iterator), a, 'Respects iterator return value of Infinity')

          assert.deepEqual(_.min([{a: 1}, {a: 0, b: 3}, {a: 4}, {a: 2}], 'a'), {a: 0, b: 3}, 'String keys use property iterator')

          assert.deepEqual(_.min([0, 2], function(c) { return c * this.x }, {x: -1}), 2, 'Iterator context')
          assert.deepEqual(_.min([[1], [2, 3], [-1, 4], [5]], 0), [-1, 4], 'Lookup falsy iterator')
          assert.deepEqual(_.min([{0: 1}, {0: 2}, {0: -1}, {a: 1}], 0), {0: -1}, 'Lookup falsy iterator')
        })

        QUnit.test('sortBy', function(assert) {
          var people = [{name: 'curly', age: 50}, {name: 'moe', age: 30}]
          people = _.sortBy(people, function(person) { return person.age })
          assert.deepEqual(_.pluck(people, 'name'), ['moe', 'curly'], 'stooges sorted by age')

          var list = [void 0, 4, 1, void 0, 3, 2]
          assert.deepEqual(_.sortBy(list, _.identity), [1, 2, 3, 4, void 0, void 0], 'sortBy with undefined values')

          list = ['one', 'two', 'three', 'four', 'five']
          var sorted = _.sortBy(list, 'length')
          assert.deepEqual(sorted, ['one', 'two', 'four', 'five', 'three'], 'sorted by length')

          function Pair(x, y) {
            this.x = x
            this.y = y
          }

          var stableArray = [
            new Pair(1, 1), new Pair(1, 2),
            new Pair(1, 3), new Pair(1, 4),
            new Pair(1, 5), new Pair(1, 6),
            new Pair(2, 1), new Pair(2, 2),
            new Pair(2, 3), new Pair(2, 4),
            new Pair(2, 5), new Pair(2, 6),
            new Pair(void 0, 1), new Pair(void 0, 2),
            new Pair(void 0, 3), new Pair(void 0, 4),
            new Pair(void 0, 5), new Pair(void 0, 6)
          ]

          var stableObject = _.object('abcdefghijklmnopqr'.split(''), stableArray)

          var actual = _.sortBy(stableArray, function(pair) {
            return pair.x
          })

          assert.deepEqual(actual, stableArray, 'sortBy should be stable for arrays')
          assert.deepEqual(_.sortBy(stableArray, 'x'), stableArray, 'sortBy accepts property string')

          actual = _.sortBy(stableObject, function(pair) {
            return pair.x
          })

          assert.deepEqual(actual, stableArray, 'sortBy should be stable for objects')

          list = ['q', 'w', 'e', 'r', 't', 'y']
          assert.deepEqual(_.sortBy(list), ['e', 'q', 'r', 't', 'w', 'y'], 'uses _.identity if iterator is not specified')
        })

        QUnit.test('groupBy', function(assert) {
          var parity = _.groupBy([1, 2, 3, 4, 5, 6], function(num) { return num % 2 })
          assert.ok('0' in parity && '1' in parity, 'created a group for each value')
          assert.deepEqual(parity[0], [2, 4, 6], 'put each even number in the right group')

          var list = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
          var grouped = _.groupBy(list, 'length')
          assert.deepEqual(grouped['3'], ['one', 'two', 'six', 'ten'])
          assert.deepEqual(grouped['4'], ['four', 'five', 'nine'])
          assert.deepEqual(grouped['5'], ['three', 'seven', 'eight'])

          var context = {}
          _.groupBy([{}], function() { assert.strictEqual(this, context) }, context)

          grouped = _.groupBy([4.2, 6.1, 6.4], function(num) {
            return Math.floor(num) > 4 ? 'hasOwnProperty' : 'constructor'
          })
          assert.strictEqual(grouped.constructor.length, 1)
          assert.strictEqual(grouped.hasOwnProperty.length, 2)

          var array = [{}]
          _.groupBy(array, function(value, index, obj) { assert.strictEqual(obj, array) })

          array = [1, 2, 1, 2, 3]
          grouped = _.groupBy(array)
          assert.strictEqual(grouped['1'].length, 2)
          assert.strictEqual(grouped['3'].length, 1)

          var matrix = [
            [1, 2],
            [1, 3],
            [2, 3]
          ]
          assert.deepEqual(_.groupBy(matrix, 0), {1: [[1, 2], [1, 3]], 2: [[2, 3]]})
          assert.deepEqual(_.groupBy(matrix, 1), {2: [[1, 2]], 3: [[1, 3], [2, 3]]})

          var liz = {name: 'Liz', stats: {power: 10}}
          var chelsea = {name: 'Chelsea', stats: {power: 10}}
          var jordan = {name: 'Jordan', stats: {power: 6}}
          var collection = [liz, chelsea, jordan]
          var expected = {
            10: [liz, chelsea],
            6: [jordan]
          }
          assert.deepEqual(_.groupBy(collection, ['stats', 'power']), expected, 'can group by deep properties')
        })

        QUnit.test('indexBy', function(assert) {
          var parity = _.indexBy([1, 2, 3, 4, 5], function(num) { return num % 2 === 0 })
          assert.strictEqual(parity['true'], 4)
          assert.strictEqual(parity['false'], 5)

          var list = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
          var grouped = _.indexBy(list, 'length')
          assert.strictEqual(grouped['3'], 'ten')
          assert.strictEqual(grouped['4'], 'nine')
          assert.strictEqual(grouped['5'], 'eight')

          var array = [1, 2, 1, 2, 3]
          grouped = _.indexBy(array)
          assert.strictEqual(grouped['1'], 1)
          assert.strictEqual(grouped['2'], 2)
          assert.strictEqual(grouped['3'], 3)
        })

        QUnit.test('countBy', function(assert) {
          var parity = _.countBy([1, 2, 3, 4, 5], function(num) { return num % 2 === 0 })
          assert.strictEqual(parity['true'], 2)
          assert.strictEqual(parity['false'], 3)

          var list = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
          var grouped = _.countBy(list, 'length')
          assert.strictEqual(grouped['3'], 4)
          assert.strictEqual(grouped['4'], 3)
          assert.strictEqual(grouped['5'], 3)

          var context = {}
          _.countBy([{}], function() { assert.strictEqual(this, context) }, context)

          grouped = _.countBy([4.2, 6.1, 6.4], function(num) {
            return Math.floor(num) > 4 ? 'hasOwnProperty' : 'constructor'
          })
          assert.strictEqual(grouped.constructor, 1)
          assert.strictEqual(grouped.hasOwnProperty, 2)

          var array = [{}]
          _.countBy(array, function(value, index, obj) { assert.strictEqual(obj, array) })

          array = [1, 2, 1, 2, 3]
          grouped = _.countBy(array)
          assert.strictEqual(grouped['1'], 2)
          assert.strictEqual(grouped['3'], 1)
        })

        QUnit.test('shuffle', function(assert) {
          assert.deepEqual(_.shuffle([1]), [1], 'behaves correctly on size 1 arrays')
          var numbers = _.range(20)
          var shuffled = _.shuffle(numbers)
          assert.notDeepEqual(numbers, shuffled, 'does change the order') // Chance of false negative: 1 in ~2.4*10^18
          assert.notStrictEqual(numbers, shuffled, 'original object is unmodified')
          assert.deepEqual(numbers, _.sortBy(shuffled), 'contains the same members before and after shuffle')

          shuffled = _.shuffle({a: 1, b: 2, c: 3, d: 4})
          assert.strictEqual(shuffled.length, 4)
          assert.deepEqual(shuffled.sort(), [1, 2, 3, 4], 'works on objects')
        })

        QUnit.test('sample', function(assert) {
          assert.strictEqual(_.sample([1]), 1, 'behaves correctly when no second parameter is given')
          assert.deepEqual(_.sample([1, 2, 3], -2), [], 'behaves correctly on negative n')
          var numbers = _.range(10)
          var allSampled = _.sample(numbers, 10).sort()
          assert.deepEqual(allSampled, numbers, 'contains the same members before and after sample')
          allSampled = _.sample(numbers, 20).sort()
          assert.deepEqual(allSampled, numbers, 'also works when sampling more objects than are present')
          assert.ok(_.contains(numbers, _.sample(numbers)), 'sampling a single element returns something from the array')
          assert.strictEqual(_.sample([]), void 0, 'sampling empty array with no number returns undefined')
          assert.notStrictEqual(_.sample([], 5), [], 'sampling empty array with a number returns an empty array')
          assert.notStrictEqual(_.sample([1, 2, 3], 0), [], 'sampling an array with 0 picks returns an empty array')
          assert.deepEqual(_.sample([1, 2], -1), [], 'sampling a negative number of picks returns an empty array')
          assert.ok(_.contains([1, 2, 3], _.sample({a: 1, b: 2, c: 3})), 'sample one value from an object')
          var partialSample = _.sample(_.range(100), 10)
          var partialSampleSorted = partialSample.sort()
          assert.notDeepEqual(partialSampleSorted, _.range(10), 'samples from the whole array, not just the beginning')
        })

        QUnit.test('toArray', function(assert) {
          assert.notOk(_.isArray(arguments), 'arguments object is not an array')
          assert.ok(_.isArray(_.toArray(arguments)), 'arguments object converted into array')
          var a = [1, 2, 3]
          assert.notStrictEqual(_.toArray(a), a, 'array is cloned')
          assert.deepEqual(_.toArray(a), [1, 2, 3], 'cloned array contains same elements')

          var numbers = _.toArray({one: 1, two: 2, three: 3})
          assert.deepEqual(numbers, [1, 2, 3], 'object flattened into array')

          var hearts = '\uD83D\uDC95'
          var pair = hearts.split('')
          var expected = [pair[0], hearts, '&', hearts, pair[1]]
          assert.deepEqual(_.toArray(expected.join('')), expected, 'maintains astral characters')
          assert.deepEqual(_.toArray(''), [], 'empty string into empty array')

          if (typeof document !== 'undefined') {
            // test in IE < 9
            var actual
            try {
              actual = _.toArray(document.childNodes)
            } catch (e) { /* ignored */ }
            assert.deepEqual(actual, _.map(document.childNodes, _.identity), 'works on NodeList')
          }
        })

        QUnit.test('size', function(assert) {
          assert.strictEqual(_.size({one: 1, two: 2, three: 3}), 3, 'can compute the size of an object')
          assert.strictEqual(_.size([1, 2, 3]), 3, 'can compute the size of an array')
          assert.strictEqual(_.size({length: 3, 0: 0, 1: 0, 2: 0}), 3, 'can compute the size of Array-likes')

          var func = function() {
            return _.size(arguments)
          }

          assert.strictEqual(func(1, 2, 3, 4), 4, 'can test the size of the arguments object')

          assert.strictEqual(_.size('hello'), 5, 'can compute the size of a string literal')
          assert.strictEqual(_.size(new String('hello')), 5, 'can compute the size of string object')

          assert.strictEqual(_.size(null), 0, 'handles nulls')
          assert.strictEqual(_.size(0), 0, 'handles numbers')
        })

        QUnit.test('partition', function(assert) {
          var list = [0, 1, 2, 3, 4, 5]
          assert.deepEqual(_.partition(list, function(x) { return x < 4 }), [[0, 1, 2, 3], [4, 5]], 'handles bool return values')
          assert.deepEqual(_.partition(list, function(x) { return x & 1 }), [[1, 3, 5], [0, 2, 4]], 'handles 0 and 1 return values')
          assert.deepEqual(_.partition(list, function(x) { return x - 3 }), [[0, 1, 2, 4, 5], [3]], 'handles other numeric return values')
          assert.deepEqual(_.partition(list, function(x) { return x > 1 ? null : true }), [[0, 1], [2, 3, 4, 5]], 'handles null return values')
          assert.deepEqual(_.partition(list, function(x) { if (x < 2) return true }), [[0, 1], [2, 3, 4, 5]], 'handles undefined return values')
          assert.deepEqual(_.partition({a: 1, b: 2, c: 3}, function(x) { return x > 1 }), [[2, 3], [1]], 'handles objects')

          assert.deepEqual(_.partition(list, function(x, index) { return index % 2 }), [[1, 3, 5], [0, 2, 4]], 'can reference the array index')
          assert.deepEqual(_.partition(list, function(x, index, arr) { return x === arr.length - 1 }), [[5], [0, 1, 2, 3, 4]], 'can reference the collection')

          // Default iterator
          assert.deepEqual(_.partition([1, false, true, '']), [[1, true], [false, '']], 'Default iterator')
          assert.deepEqual(_.partition([{x: 1}, {x: 0}, {x: 1}], 'x'), [[{x: 1}, {x: 1}], [{x: 0}]], 'Takes a string')

          // Context
          var predicate = function(x) { return x === this.x }
          assert.deepEqual(_.partition([1, 2, 3], predicate, {x: 2}), [[2], [1, 3]], 'partition takes a context argument')

          assert.deepEqual(_.partition([{a: 1}, {b: 2}, {a: 1, b: 2}], {a: 1}), [[{a: 1}, {a: 1, b: 2}], [{b: 2}]], 'predicate can be object')

          var object = {a: 1}
          _.partition(object, function(val, key, obj) {
            assert.strictEqual(val, 1)
            assert.strictEqual(key, 'a')
            assert.strictEqual(obj, object)
            assert.strictEqual(this, predicate)
          }, predicate)
        })

      }
    }))

    it('Functions', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('underscore')

      registerTests()

      var failures = []

      QUnit.testDone(function(details) {
        if (details.failed) {
          failures = failures.concat(details.assertions.filter(function(v) { return !v.result }).map(function(v) { return { name: details.module + '.' + details.name, message: v.message} }))
        }
      })

      QUnit.start()

      if (failures.length) {
        throw {
          code: 'kError',
          reason: '1 or more tests failed.',
          faults: failures
        }
      }

      function registerTests() {

        QUnit.module('Functions')

        /**
                QUnit.test('bind', function(assert) {
                    var context = {name: 'moe'};
                    var func = function(arg) { return 'name: ' + (this.name || arg); };
                    var bound = _.bind(func, context);
                    assert.strictEqual(bound(), 'name: moe', 'can bind a function to a context');

                    bound = _(func).bind(context);
                    assert.strictEqual(bound(), 'name: moe', 'can do OO-style binding');

                    bound = _.bind(func, null, 'curly');
                    var result = bound();

                    func = function(salutation, name) { return salutation + ': ' + name; };
                    func = _.bind(func, this, 'hello');
                    assert.strictEqual(func('moe'), 'hello: moe', 'the function was partially applied in advance');

                    func = _.bind(func, this, 'curly');
                    assert.strictEqual(func(), 'hello: curly', 'the function was completely applied in advance');

                    func = function(salutation, firstname, lastname) { return salutation + ': ' + firstname + ' ' + lastname; };
                    func = _.bind(func, this, 'hello', 'moe', 'curly');
                    assert.strictEqual(func(), 'hello: moe curly', 'the function was partially applied in advance and can accept multiple arguments');

                    func = function() { return this; };
                    assert.strictEqual(typeof _.bind(func, 0)(), 'object', 'binding a primitive to `this` returns a wrapped primitive');

                    assert.strictEqual(_.bind(func, 0)().valueOf(), 0, 'can bind a function to `0`');
                    assert.strictEqual(_.bind(func, '')().valueOf(), '', 'can bind a function to an empty string');
                    assert.strictEqual(_.bind(func, false)().valueOf(), false, 'can bind a function to `false`');

                    // These tests are only meaningful when using a browser without a native bind function
                    // To test this with a modern browser, set underscore's nativeBind to undefined
                    var F = function() { return this; };
                    var boundf = _.bind(F, {hello: 'moe curly'});
                    var Boundf = boundf; // make eslint happy.
                    var newBoundf = new Boundf();
                    assert.strictEqual(newBoundf.hello, void 0, 'function should not be bound to the context, to comply with ECMAScript 5');
                    assert.strictEqual(boundf().hello, 'moe curly', "When called without the new operator, it's OK to be bound to the context");
                    assert.ok(newBoundf instanceof F, 'a bound instance is an instance of the original function');

                    assert.raises(function() { _.bind('notafunction'); }, TypeError, 'throws an error when binding to a non-function');
                });
                 */

        QUnit.test('partial', function(assert) {
          var obj = {name: 'moe'}
          var func = function() { return this.name + ' ' + _.toArray(arguments).join(' ') }

          obj.func = _.partial(func, 'a', 'b')
          assert.strictEqual(obj.func('c', 'd'), 'moe a b c d', 'can partially apply')

          obj.func = _.partial(func, _, 'b', _, 'd')
          assert.strictEqual(obj.func('a', 'c'), 'moe a b c d', 'can partially apply with placeholders')

          func = _.partial(function() { return arguments.length }, _, 'b', _, 'd')
          assert.strictEqual(func('a', 'c', 'e'), 5, 'accepts more arguments than the number of placeholders')
          assert.strictEqual(func('a'), 4, 'accepts fewer arguments than the number of placeholders')

          func = _.partial(function() { return typeof arguments[2] }, _, 'b', _, 'd')
          assert.strictEqual(func('a'), 'undefined', 'unfilled placeholders are undefined')

          // passes context
          function MyWidget(name, options) {
            this.name = name
            this.options = options
          }
          MyWidget.prototype.get = function() {
            return this.name
          }
          var MyWidgetWithCoolOpts = _.partial(MyWidget, _, {a: 1})
          var widget = new MyWidgetWithCoolOpts('foo')
          assert.ok(widget instanceof MyWidget, 'Can partially bind a constructor')
          assert.strictEqual(widget.get(), 'foo', 'keeps prototype')
          assert.deepEqual(widget.options, {a: 1})

          _.partial.placeholder = obj
          func = _.partial(function() { return arguments.length }, obj, 'b', obj, 'd')
          assert.strictEqual(func('a'), 4, 'allows the placeholder to be swapped out')

          _.partial.placeholder = {}
          func = _.partial(function() { return arguments.length }, obj, 'b', obj, 'd')
          assert.strictEqual(func('a'), 5, 'swapping the placeholder preserves previously bound arguments')

          _.partial.placeholder = _
        })

        QUnit.test('bindAll', function(assert) {
          var curly = {name: 'curly'}
          var moe = {
            name: 'moe',
            getName: function() { return 'name: ' + this.name },
            sayHi: function() { return 'hi: ' + this.name }
          }
          curly.getName = moe.getName
          _.bindAll(moe, 'getName', 'sayHi')
          curly.sayHi = moe.sayHi
          assert.strictEqual(curly.getName(), 'name: curly', 'unbound function is bound to current object')
          assert.strictEqual(curly.sayHi(), 'hi: moe', 'bound function is still bound to original object')

          curly = {name: 'curly'}
          moe = {
            name: 'moe',
            getName: function() { return 'name: ' + this.name },
            sayHi: function() { return 'hi: ' + this.name },
            sayLast: function() { return this.sayHi(_.last(arguments)) }
          }

          assert.raises(function() { _.bindAll(moe) }, Error, 'throws an error for bindAll with no functions named')
          assert.raises(function() { _.bindAll(moe, 'sayBye') }, TypeError, 'throws an error for bindAll if the given key is undefined')
          assert.raises(function() { _.bindAll(moe, 'name') }, TypeError, 'throws an error for bindAll if the given key is not a function')

          _.bindAll(moe, 'sayHi', 'sayLast')
          curly.sayHi = moe.sayHi
          assert.strictEqual(curly.sayHi(), 'hi: moe')

          var sayLast = moe.sayLast
          assert.strictEqual(sayLast(1, 2, 3, 4, 5, 6, 7, 'Tom'), 'hi: moe', 'createCallback works with any number of arguments')

          _.bindAll(moe, ['getName'])
          var getName = moe.getName
          assert.strictEqual(getName(), 'name: moe', 'flattens arguments into a single list')
        })

        QUnit.test('memoize', function(assert) {
          var fib = function(n) {
            return n < 2 ? n : fib(n - 1) + fib(n - 2)
          }
          assert.strictEqual(fib(10), 55, 'a memoized version of fibonacci produces identical results')
          fib = _.memoize(fib) // Redefine `fib` for memoization
          assert.strictEqual(fib(10), 55, 'a memoized version of fibonacci produces identical results')

          var o = function(str) {
            return str
          }
          var fastO = _.memoize(o)
          assert.strictEqual(o('toString'), 'toString', 'checks hasOwnProperty')
          assert.strictEqual(fastO('toString'), 'toString', 'checks hasOwnProperty')

          // Expose the cache.
          var upper = _.memoize(function(s) {
            return s.toUpperCase()
          })
          assert.strictEqual(upper('foo'), 'FOO')
          assert.strictEqual(upper('bar'), 'BAR')
          assert.deepEqual(upper.cache, {foo: 'FOO', bar: 'BAR'})
          upper.cache = {foo: 'BAR', bar: 'FOO'}
          assert.strictEqual(upper('foo'), 'BAR')
          assert.strictEqual(upper('bar'), 'FOO')

          var hashed = _.memoize(function(key) {
            // https://github.com/jashkenas/underscore/pull/1679#discussion_r13736209
            assert.ok(/[a-z]+/.test(key), 'hasher doesn\'t change keys')
            return key
          }, function(key) {
            return key.toUpperCase()
          })
          hashed('yep')
          assert.deepEqual(hashed.cache, {YEP: 'yep'}, 'takes a hasher')

          // Test that the hash function can be used to swizzle the key.
          var objCacher = _.memoize(function(value, key) {
            return {key: key, value: value}
          }, function(value, key) {
            return key
          })
          var myObj = objCacher('a', 'alpha')
          var myObjAlias = objCacher('b', 'alpha')
          assert.notStrictEqual(myObj, void 0, 'object is created if second argument used as key')
          assert.strictEqual(myObj, myObjAlias, 'object is cached if second argument used as key')
          assert.strictEqual(myObj.value, 'a', 'object is not modified if second argument used as key')
        })

        QUnit.test('once', function(assert) {
          var num = 0
          var increment = _.once(function() { return ++num })
          increment()
          increment()
          assert.strictEqual(num, 1)

          assert.strictEqual(increment(), 1, 'stores a memo to the last value')
        })

        QUnit.test('Recursive onced function.', function(assert) {
          assert.expect(1)
          var f = _.once(function() {
            assert.ok(true)
            f()
          })
          f()
        })

        QUnit.test('wrap', function(assert) {
          var greet = function(name) { return 'hi: ' + name }
          var backwards = _.wrap(greet, function(func, name) { return func(name) + ' ' + name.split('').reverse().join('') })
          assert.strictEqual(backwards('moe'), 'hi: moe eom', 'wrapped the salutation function')

          var inner = function() { return 'Hello ' }
          var obj = {name: 'Moe'}
          obj.hi = _.wrap(inner, function(fn) { return fn() + this.name })
          assert.strictEqual(obj.hi(), 'Hello Moe')

          var noop = function() {}
          var wrapped = _.wrap(noop, function() { return Array.prototype.slice.call(arguments, 0) })
          var ret = wrapped(['whats', 'your'], 'vector', 'victor')
          assert.deepEqual(ret, [noop, ['whats', 'your'], 'vector', 'victor'])
        })

        QUnit.test('negate', function(assert) {
          var isOdd = function(n) { return n & 1 }
          assert.strictEqual(_.negate(isOdd)(2), true, 'should return the complement of the given function')
          assert.strictEqual(_.negate(isOdd)(3), false, 'should return the complement of the given function')
        })

        QUnit.test('compose', function(assert) {
          var greet = function(name) { return 'hi: ' + name }
          var exclaim = function(sentence) { return sentence + '!' }
          var composed = _.compose(exclaim, greet)
          assert.strictEqual(composed('moe'), 'hi: moe!', 'can compose a function that takes another')

          composed = _.compose(greet, exclaim)
          assert.strictEqual(composed('moe'), 'hi: moe!', 'in this case, the functions are also commutative')

          // f(g(h(x, y, z)))
          function h(x, y, z) {
            assert.strictEqual(arguments.length, 3, 'First function called with multiple args')
            return z * y
          }
          function g(x) {
            assert.strictEqual(arguments.length, 1, 'Composed function is called with 1 argument')
            return x
          }
          function f(x) {
            assert.strictEqual(arguments.length, 1, 'Composed function is called with 1 argument')
            return x * 2
          }
          composed = _.compose(f, g, h)
          assert.strictEqual(composed(1, 2, 3), 12)
        })

        QUnit.test('after', function(assert) {
          var testAfter = function(afterAmount, timesCalled) {
            var afterCalled = 0
            var after = _.after(afterAmount, function() {
              afterCalled++
            })
            while (timesCalled--) after()
            return afterCalled
          }

          assert.strictEqual(testAfter(5, 5), 1, 'after(N) should fire after being called N times')
          assert.strictEqual(testAfter(5, 4), 0, 'after(N) should not fire unless called N times')
          assert.strictEqual(testAfter(0, 0), 0, 'after(0) should not fire immediately')
          assert.strictEqual(testAfter(0, 1), 1, 'after(0) should fire when first invoked')
        })

        QUnit.test('before', function(assert) {
          var testBefore = function(beforeAmount, timesCalled) {
            var beforeCalled = 0
            var before = _.before(beforeAmount, function() { beforeCalled++ })
            while (timesCalled--) before()
            return beforeCalled
          }

          assert.strictEqual(testBefore(5, 5), 4, 'before(N) should not fire after being called N times')
          assert.strictEqual(testBefore(5, 4), 4, 'before(N) should fire before being called N times')
          assert.strictEqual(testBefore(0, 0), 0, 'before(0) should not fire immediately')
          assert.strictEqual(testBefore(0, 1), 0, 'before(0) should not fire when first invoked')

          var context = {num: 0}
          var increment = _.before(3, function() { return ++this.num })
          _.times(10, increment, context)
          assert.strictEqual(increment(), 2, 'stores a memo to the last value')
          assert.strictEqual(context.num, 2, 'provides context')
        })

        QUnit.test('iteratee', function(assert) {
          var identity = _.iteratee()
          assert.strictEqual(identity, _.identity, '_.iteratee is exposed as an external function.')

          function fn() {
            return arguments
          }
          _.each([_.iteratee(fn), _.iteratee(fn, {})], function(cb) {
            assert.strictEqual(cb().length, 0)
            assert.deepEqual(_.toArray(cb(1, 2, 3)), _.range(1, 4))
            assert.deepEqual(_.toArray(cb(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)), _.range(1, 11))
          })

          var deepProperty = _.iteratee(['a', 'b'])
          assert.strictEqual(deepProperty({a: {b: 2}}), 2, 'treats an array as a deep property accessor')

          // Test custom iteratee
          var builtinIteratee = _.iteratee
          _.iteratee = function(value) {
            // RegEx values return a function that returns the number of matches
            if (_.isRegExp(value)) {
              return function(obj) {
                return (obj.match(value) || []).length
              }
            }
            return value
          }

          var collection = ['foo', 'bar', 'bbiz']

          // Test all methods that claim to be transformed through `_.iteratee`
          assert.deepEqual(_.countBy(collection, /b/g), {0: 1, 1: 1, 2: 1})
          assert.strictEqual(_.every(collection, /b/g), false)
          assert.deepEqual(_.filter(collection, /b/g), ['bar', 'bbiz'])
          assert.strictEqual(_.find(collection, /b/g), 'bar')
          assert.strictEqual(_.findIndex(collection, /b/g), 1)
          assert.strictEqual(_.findKey(collection, /b/g), '1')
          assert.strictEqual(_.findLastIndex(collection, /b/g), 2)
          assert.deepEqual(_.groupBy(collection, /b/g), {0: ['foo'], 1: ['bar'], 2: ['bbiz']})
          assert.deepEqual(_.indexBy(collection, /b/g), {0: 'foo', 1: 'bar', 2: 'bbiz'})
          assert.deepEqual(_.map(collection, /b/g), [0, 1, 2])
          assert.strictEqual(_.max(collection, /b/g), 'bbiz')
          assert.strictEqual(_.min(collection, /b/g), 'foo')
          assert.deepEqual(_.partition(collection, /b/g), [['bar', 'bbiz'], ['foo']])
          assert.deepEqual(_.reject(collection, /b/g), ['foo'])
          assert.strictEqual(_.some(collection, /b/g), true)
          assert.deepEqual(_.sortBy(collection, /b/g), ['foo', 'bar', 'bbiz'])
          assert.strictEqual(_.sortedIndex(collection, 'blah', /b/g), 1)
          assert.deepEqual(_.uniq(collection, /b/g), ['foo', 'bar', 'bbiz'])

          var objCollection = {a: 'foo', b: 'bar', c: 'bbiz'}
          assert.deepEqual(_.mapObject(objCollection, /b/g), {a: 0, b: 1, c: 2})

          // Restore the builtin iteratee
          _.iteratee = builtinIteratee
        })

        QUnit.test('restArgs', function(assert) {
          assert.expect(10)
          _.restArgs(function(a, args) {
            assert.strictEqual(a, 1)
            assert.deepEqual(args, [2, 3], 'collects rest arguments into an array')
          })(1, 2, 3)

          _.restArgs(function(a, args) {
            assert.strictEqual(a, void 0)
            assert.deepEqual(args, [], 'passes empty array if there are not enough arguments')
          })()

          _.restArgs(function(a, b, c, args) {
            assert.strictEqual(arguments.length, 4)
            assert.deepEqual(args, [4, 5], 'works on functions with many named parameters')
          })(1, 2, 3, 4, 5)

          var obj = {}
          _.restArgs(function() {
            assert.strictEqual(this, obj, 'invokes function with this context')
          }).call(obj)

          _.restArgs(function(array, iteratee, context) {
            assert.deepEqual(array, [1, 2, 3, 4], 'startIndex can be used manually specify index of rest parameter')
            assert.strictEqual(iteratee, void 0)
            assert.strictEqual(context, void 0)
          }, 0)(1, 2, 3, 4)
        })

      }
    }))

    it('Objects', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('underscore')

      registerTests()

      var failures = []

      QUnit.testDone(function(details) {
        if (details.failed) {
          failures = failures.concat(details.assertions.filter(function(v) { return !v.result }).map(function(v) { return { name: details.module + '.' + details.name, message: v.message} }))
        }
      })

      QUnit.start()

      if (failures.length) {
        throw {
          code: 'kError',
          reason: '1 or more tests failed.',
          faults: failures
        }
      }

      function registerTests() {

        QUnit.module('Objects')
        /*
                QUnit.test('keys', function(assert) {
                    assert.deepEqual(_.keys({one: 1, two: 2}), ['one', 'two'], 'can extract the keys from an object');
                    // the test above is not safe because it relies on for-in enumeration order
                    var a = []; a[1] = 0;
                    assert.deepEqual(_.keys(a), ['1'], 'is not fooled by sparse arrays; see issue #95');
                    assert.deepEqual(_.keys(null), []);
                    assert.deepEqual(_.keys(void 0), []);
                    assert.deepEqual(_.keys(1), []);
                    assert.deepEqual(_.keys('a'), []);
                    assert.deepEqual(_.keys(true), []);

                    // keys that may be missed if the implementation isn't careful
                    var trouble = {
                        constructor: Object,
                        valueOf: _.noop,
                        hasOwnProperty: null,
                        toString: 5,
                        toLocaleString: void 0,
                        propertyIsEnumerable: /a/,
                        isPrototypeOf: this,
                        __defineGetter__: Boolean,
                        __defineSetter__: {},
                        __lookupSetter__: false,
                        __lookupGetter__: []
                    };
                    var troubleKeys = ['constructor', 'valueOf', 'hasOwnProperty', 'toString', 'toLocaleString', 'propertyIsEnumerable',
                        'isPrototypeOf', '__defineGetter__', '__defineSetter__', '__lookupSetter__', '__lookupGetter__'].sort();
                    assert.deepEqual(_.keys(trouble).sort(), troubleKeys, 'matches non-enumerable properties');
                });

                QUnit.test('allKeys', function(assert) {
                    assert.deepEqual(_.allKeys({one: 1, two: 2}), ['one', 'two'], 'can extract the allKeys from an object');
                    // the test above is not safe because it relies on for-in enumeration order
                    var a = []; a[1] = 0;
                    assert.deepEqual(_.allKeys(a), ['1'], 'is not fooled by sparse arrays; see issue #95');

                    a.a = a;
                    assert.deepEqual(_.allKeys(a), ['1', 'a'], 'is not fooled by sparse arrays with additional properties');

                    _.each([null, void 0, 1, 'a', true, NaN, {}, [], new Number(5), new Date(0)], function(val) {
                        assert.deepEqual(_.allKeys(val), []);
                    });

                    // allKeys that may be missed if the implementation isn't careful
                    var trouble = {
                        constructor: Object,
                        valueOf: _.noop,
                        hasOwnProperty: null,
                        toString: 5,
                        toLocaleString: void 0,
                        propertyIsEnumerable: /a/,
                        isPrototypeOf: this
                    };
                    var troubleKeys = ['constructor', 'valueOf', 'hasOwnProperty', 'toString', 'toLocaleString', 'propertyIsEnumerable',
                        'isPrototypeOf'].sort();
                    assert.deepEqual(_.allKeys(trouble).sort(), troubleKeys, 'matches non-enumerable properties');

                    function A() {}
                    A.prototype.foo = 'foo';
                    var b = new A();
                    b.bar = 'bar';
                    assert.deepEqual(_.allKeys(b).sort(), ['bar', 'foo'], 'should include inherited keys');

                    function y() {}
                    y.x = 'z';
                    assert.deepEqual(_.allKeys(y), ['x'], 'should get keys from constructor');
                });

                QUnit.test('values', function(assert) {
                    assert.deepEqual(_.values({one: 1, two: 2}), [1, 2], 'can extract the values from an object');
                    assert.deepEqual(_.values({one: 1, two: 2, length: 3}), [1, 2, 3], '... even when one of them is "length"');
                });

                QUnit.test('pairs', function(assert) {
                    assert.deepEqual(_.pairs({one: 1, two: 2}), [['one', 1], ['two', 2]], 'can convert an object into pairs');
                    assert.deepEqual(_.pairs({one: 1, two: 2, length: 3}), [['one', 1], ['two', 2], ['length', 3]], '... even when one of them is "length"');
                });

                QUnit.test('invert', function(assert) {
                    var obj = {first: 'Moe', second: 'Larry', third: 'Curly'};
                    assert.deepEqual(_.keys(_.invert(obj)), ['Moe', 'Larry', 'Curly'], 'can invert an object');
                    assert.deepEqual(_.invert(_.invert(obj)), obj, 'two inverts gets you back where you started');

                    obj = {length: 3};
                    assert.strictEqual(_.invert(obj)['3'], 'length', 'can invert an object with "length"');
                });

                QUnit.test('functions', function(assert) {
                    var obj = {a: 'dash', b: _.map, c: /yo/, d: _.reduce};
                    assert.deepEqual(['b', 'd'], _.functions(obj), 'can grab the function names of any passed-in object');

                    var Animal = function(){};
                    Animal.prototype.run = function(){};
                    assert.deepEqual(_.functions(new Animal), ['run'], 'also looks up functions on the prototype');
                });

                QUnit.test('methods', function(assert) {
                    assert.strictEqual(_.methods, _.functions, 'is an alias for functions');
                });

                QUnit.test('extend', function(assert) {
                    var result;
                    assert.strictEqual(_.extend({}, {a: 'b'}).a, 'b', 'can extend an object with the attributes of another');
                    assert.strictEqual(_.extend({a: 'x'}, {a: 'b'}).a, 'b', 'properties in source override destination');
                    assert.strictEqual(_.extend({x: 'x'}, {a: 'b'}).x, 'x', "properties not in source don't get overridden");
                    result = _.extend({x: 'x'}, {a: 'a'}, {b: 'b'});
                    assert.deepEqual(result, {x: 'x', a: 'a', b: 'b'}, 'can extend from multiple source objects');
                    result = _.extend({x: 'x'}, {a: 'a', x: 2}, {a: 'b'});
                    assert.deepEqual(result, {x: 2, a: 'b'}, 'extending from multiple source objects last property trumps');
                    result = _.extend({}, {a: void 0, b: null});
                    assert.deepEqual(_.keys(result), ['a', 'b'], 'extend copies undefined values');

                    var F = function() {};
                    F.prototype = {a: 'b'};
                    var subObj = new F();
                    subObj.c = 'd';
                    assert.deepEqual(_.extend({}, subObj), {a: 'b', c: 'd'}, 'extend copies all properties from source');
                    _.extend(subObj, {});
                    assert.notOk(subObj.hasOwnProperty('a'), "extend does not convert destination object's 'in' properties to 'own' properties");

                    try {
                        result = {};
                        _.extend(result, null, void 0, {a: 1});
                    } catch (e) { }

                    assert.strictEqual(result.a, 1, 'should not error on `null` or `undefined` sources');

                    assert.strictEqual(_.extend(null, {a: 1}), null, 'extending null results in null');
                    assert.strictEqual(_.extend(void 0, {a: 1}), void 0, 'extending undefined results in undefined');
                });

                QUnit.test('extendOwn', function(assert) {
                    var result;
                    assert.strictEqual(_.extendOwn({}, {a: 'b'}).a, 'b', 'can extend an object with the attributes of another');
                    assert.strictEqual(_.extendOwn({a: 'x'}, {a: 'b'}).a, 'b', 'properties in source override destination');
                    assert.strictEqual(_.extendOwn({x: 'x'}, {a: 'b'}).x, 'x', "properties not in source don't get overridden");
                    result = _.extendOwn({x: 'x'}, {a: 'a'}, {b: 'b'});
                    assert.deepEqual(result, {x: 'x', a: 'a', b: 'b'}, 'can extend from multiple source objects');
                    result = _.extendOwn({x: 'x'}, {a: 'a', x: 2}, {a: 'b'});
                    assert.deepEqual(result, {x: 2, a: 'b'}, 'extending from multiple source objects last property trumps');
                    assert.deepEqual(_.extendOwn({}, {a: void 0, b: null}), {a: void 0, b: null}, 'copies undefined values');

                    var F = function() {};
                    F.prototype = {a: 'b'};
                    var subObj = new F();
                    subObj.c = 'd';
                    assert.deepEqual(_.extendOwn({}, subObj), {c: 'd'}, 'copies own properties from source');

                    result = {};
                    assert.deepEqual(_.extendOwn(result, null, void 0, {a: 1}), {a: 1}, 'should not error on `null` or `undefined` sources');

                    assert.strictEqual(_.extendOwn(void 0, {a: 1}), void 0, 'extending undefined results in undefined');

                    result = _.extendOwn({a: 1, 0: 2, 1: '5', length: 6}, {0: 1, 1: 2, length: 2});
                    assert.deepEqual(result, {a: 1, 0: 1, 1: 2, length: 2}, 'should treat array-like objects like normal objects');
                });

                QUnit.test('assign', function(assert) {
                    assert.strictEqual(_.assign, _.extendOwn, 'is an alias for extendOwn');
                });

                QUnit.test('pick', function(assert) {
                    var result;
                    result = _.pick({a: 1, b: 2, c: 3}, 'a', 'c');
                    assert.deepEqual(result, {a: 1, c: 3}, 'can restrict properties to those named');
                    result = _.pick({a: 1, b: 2, c: 3}, ['b', 'c']);
                    assert.deepEqual(result, {b: 2, c: 3}, 'can restrict properties to those named in an array');
                    result = _.pick({a: 1, b: 2, c: 3}, ['a'], 'b');
                    assert.deepEqual(result, {a: 1, b: 2}, 'can restrict properties to those named in mixed args');
                    result = _.pick(['a', 'b'], 1);
                    assert.deepEqual(result, {1: 'b'}, 'can pick numeric properties');

                    _.each([null, void 0], function(val) {
                        assert.deepEqual(_.pick(val, 'hasOwnProperty'), {}, 'Called with null/undefined');
                        assert.deepEqual(_.pick(val, _.constant(true)), {});
                    });
                    assert.deepEqual(_.pick(5, 'toString', 'b'), {toString: Number.prototype.toString}, 'can iterate primitives');

                    var data = {a: 1, b: 2, c: 3};
                    var callback = function(value, key, object) {
                        assert.strictEqual(key, {1: 'a', 2: 'b', 3: 'c'}[value]);
                        assert.strictEqual(object, data);
                        return value !== this.value;
                    };
                    result = _.pick(data, callback, {value: 2});
                    assert.deepEqual(result, {a: 1, c: 3}, 'can accept a predicate and context');

                    var Obj = function(){};
                    Obj.prototype = {a: 1, b: 2, c: 3};
                    var instance = new Obj();
                    assert.deepEqual(_.pick(instance, 'a', 'c'), {a: 1, c: 3}, 'include prototype props');

                    assert.deepEqual(_.pick(data, function(val, key) {
                        return this[key] === 3 && this === instance;
                    }, instance), {c: 3}, 'function is given context');

                    assert.notOk(_.has(_.pick({}, 'foo'), 'foo'), 'does not set own property if property not in object');
                    _.pick(data, function(value, key, obj) {
                        assert.strictEqual(obj, data, 'passes same object as third parameter of iteratee');
                    });
                });

                QUnit.test('omit', function(assert) {
                    var result;
                    result = _.omit({a: 1, b: 2, c: 3}, 'b');
                    assert.deepEqual(result, {a: 1, c: 3}, 'can omit a single named property');
                    result = _.omit({a: 1, b: 2, c: 3}, 'a', 'c');
                    assert.deepEqual(result, {b: 2}, 'can omit several named properties');
                    result = _.omit({a: 1, b: 2, c: 3}, ['b', 'c']);
                    assert.deepEqual(result, {a: 1}, 'can omit properties named in an array');
                    result = _.omit(['a', 'b'], 0);
                    assert.deepEqual(result, {1: 'b'}, 'can omit numeric properties');

                    assert.deepEqual(_.omit(null, 'a', 'b'), {}, 'non objects return empty object');
                    assert.deepEqual(_.omit(void 0, 'toString'), {}, 'null/undefined return empty object');
                    assert.deepEqual(_.omit(5, 'toString', 'b'), {}, 'returns empty object for primitives');

                    var data = {a: 1, b: 2, c: 3};
                    var callback = function(value, key, object) {
                        assert.strictEqual(key, {1: 'a', 2: 'b', 3: 'c'}[value]);
                        assert.strictEqual(object, data);
                        return value !== this.value;
                    };
                    result = _.omit(data, callback, {value: 2});
                    assert.deepEqual(result, {b: 2}, 'can accept a predicate');

                    var Obj = function(){};
                    Obj.prototype = {a: 1, b: 2, c: 3};
                    var instance = new Obj();
                    assert.deepEqual(_.omit(instance, 'b'), {a: 1, c: 3}, 'include prototype props');

                    assert.deepEqual(_.omit(data, function(val, key) {
                        return this[key] === 3 && this === instance;
                    }, instance), {a: 1, b: 2}, 'function is given context');
                });

                QUnit.test('defaults', function(assert) {
                    var options = {zero: 0, one: 1, empty: '', nan: NaN, nothing: null};

                    _.defaults(options, {zero: 1, one: 10, twenty: 20, nothing: 'str'});
                    assert.strictEqual(options.zero, 0, 'value exists');
                    assert.strictEqual(options.one, 1, 'value exists');
                    assert.strictEqual(options.twenty, 20, 'default applied');
                    assert.strictEqual(options.nothing, null, "null isn't overridden");

                    _.defaults(options, {empty: 'full'}, {nan: 'nan'}, {word: 'word'}, {word: 'dog'});
                    assert.strictEqual(options.empty, '', 'value exists');
                    assert.ok(_.isNaN(options.nan), "NaN isn't overridden");
                    assert.strictEqual(options.word, 'word', 'new value is added, first one wins');

                    try {
                        options = {};
                        _.defaults(options, null, void 0, {a: 1});
                    } catch (e) { }

                    assert.strictEqual(options.a, 1, 'should not error on `null` or `undefined` sources');

                    assert.deepEqual(_.defaults(null, {a: 1}), {a: 1}, 'defaults skips nulls');
                    assert.deepEqual(_.defaults(void 0, {a: 1}), {a: 1}, 'defaults skips undefined');
                });

                QUnit.test('clone', function(assert) {
                    var moe = {name: 'moe', lucky: [13, 27, 34]};
                    var clone = _.clone(moe);
                    assert.strictEqual(clone.name, 'moe', 'the clone as the attributes of the original');

                    clone.name = 'curly';
                    assert.ok(clone.name === 'curly' && moe.name === 'moe', 'clones can change shallow attributes without affecting the original');

                    clone.lucky.push(101);
                    assert.strictEqual(_.last(moe.lucky), 101, 'changes to deep attributes are shared with the original');

                    assert.strictEqual(_.clone(void 0), void 0, 'non objects should not be changed by clone');
                    assert.strictEqual(_.clone(1), 1, 'non objects should not be changed by clone');
                    assert.strictEqual(_.clone(null), null, 'non objects should not be changed by clone');
                });

                QUnit.test('create', function(assert) {
                    var Parent = function() {};
                    Parent.prototype = {foo: function() {}, bar: 2};

                    _.each(['foo', null, void 0, 1], function(val) {
                        assert.deepEqual(_.create(val), {}, 'should return empty object when a non-object is provided');
                    });

                    assert.ok(_.create([]) instanceof Array, 'should return new instance of array when array is provided');

                    var Child = function() {};
                    Child.prototype = _.create(Parent.prototype);
                    assert.ok(new Child instanceof Parent, 'object should inherit prototype');

                    var func = function() {};
                    Child.prototype = _.create(Parent.prototype, {func: func});
                    assert.strictEqual(Child.prototype.func, func, 'properties should be added to object');

                    Child.prototype = _.create(Parent.prototype, {constructor: Child});
                    assert.strictEqual(Child.prototype.constructor, Child);

                    Child.prototype.foo = 'foo';
                    var created = _.create(Child.prototype, new Child);
                    assert.notOk(created.hasOwnProperty('foo'), 'should only add own properties');
                });

                QUnit.test('isEqual', function(assert) {
                    function First() {
                        this.value = 1;
                    }
                    First.prototype.value = 1;
                    function Second() {
                        this.value = 1;
                    }
                    Second.prototype.value = 2;

                    // Basic equality and identity comparisons.
                    assert.ok(_.isEqual(null, null), '`null` is equal to `null`');
                    assert.ok(_.isEqual(), '`undefined` is equal to `undefined`');

                    assert.notOk(_.isEqual(0, -0), '`0` is not equal to `-0`');
                    assert.notOk(_.isEqual(-0, 0), 'Commutative equality is implemented for `0` and `-0`');
                    assert.notOk(_.isEqual(null, void 0), '`null` is not equal to `undefined`');
                    assert.notOk(_.isEqual(void 0, null), 'Commutative equality is implemented for `null` and `undefined`');

                    // String object and primitive comparisons.
                    assert.ok(_.isEqual('Curly', 'Curly'), 'Identical string primitives are equal');
                    assert.ok(_.isEqual(new String('Curly'), new String('Curly')), 'String objects with identical primitive values are equal');
                    assert.ok(_.isEqual(new String('Curly'), 'Curly'), 'String primitives and their corresponding object wrappers are equal');
                    assert.ok(_.isEqual('Curly', new String('Curly')), 'Commutative equality is implemented for string objects and primitives');

                    assert.notOk(_.isEqual('Curly', 'Larry'), 'String primitives with different values are not equal');
                    assert.notOk(_.isEqual(new String('Curly'), new String('Larry')), 'String objects with different primitive values are not equal');
                    assert.notOk(_.isEqual(new String('Curly'), {toString: function(){ return 'Curly'; }}), 'String objects and objects with a custom `toString` method are not equal');

                    // Number object and primitive comparisons.
                    assert.ok(_.isEqual(75, 75), 'Identical number primitives are equal');
                    assert.ok(_.isEqual(new Number(75), new Number(75)), 'Number objects with identical primitive values are equal');
                    assert.ok(_.isEqual(75, new Number(75)), 'Number primitives and their corresponding object wrappers are equal');
                    assert.ok(_.isEqual(new Number(75), 75), 'Commutative equality is implemented for number objects and primitives');
                    assert.notOk(_.isEqual(new Number(0), -0), '`new Number(0)` and `-0` are not equal');
                    assert.notOk(_.isEqual(0, new Number(-0)), 'Commutative equality is implemented for `new Number(0)` and `-0`');

                    assert.notOk(_.isEqual(new Number(75), new Number(63)), 'Number objects with different primitive values are not equal');
                    assert.notOk(_.isEqual(new Number(63), {valueOf: function(){ return 63; }}), 'Number objects and objects with a `valueOf` method are not equal');

                    // Comparisons involving `NaN`.
                    assert.ok(_.isEqual(NaN, NaN), '`NaN` is equal to `NaN`');
                    assert.ok(_.isEqual(new Number(NaN), NaN), 'Object(`NaN`) is equal to `NaN`');
                    assert.notOk(_.isEqual(61, NaN), 'A number primitive is not equal to `NaN`');
                    assert.notOk(_.isEqual(new Number(79), NaN), 'A number object is not equal to `NaN`');
                    assert.notOk(_.isEqual(Infinity, NaN), '`Infinity` is not equal to `NaN`');

                    // Boolean object and primitive comparisons.
                    assert.ok(_.isEqual(true, true), 'Identical boolean primitives are equal');
                    assert.ok(_.isEqual(new Boolean, new Boolean), 'Boolean objects with identical primitive values are equal');
                    assert.ok(_.isEqual(true, new Boolean(true)), 'Boolean primitives and their corresponding object wrappers are equal');
                    assert.ok(_.isEqual(new Boolean(true), true), 'Commutative equality is implemented for booleans');
                    assert.notOk(_.isEqual(new Boolean(true), new Boolean), 'Boolean objects with different primitive values are not equal');

                    // Common type coercions.
                    assert.notOk(_.isEqual(new Boolean(false), true), '`new Boolean(false)` is not equal to `true`');
                    assert.notOk(_.isEqual('75', 75), 'String and number primitives with like values are not equal');
                    assert.notOk(_.isEqual(new Number(63), new String(63)), 'String and number objects with like values are not equal');
                    assert.notOk(_.isEqual(75, '75'), 'Commutative equality is implemented for like string and number values');
                    assert.notOk(_.isEqual(0, ''), 'Number and string primitives with like values are not equal');
                    assert.notOk(_.isEqual(1, true), 'Number and boolean primitives with like values are not equal');
                    assert.notOk(_.isEqual(new Boolean(false), new Number(0)), 'Boolean and number objects with like values are not equal');
                    assert.notOk(_.isEqual(false, new String('')), 'Boolean primitives and string objects with like values are not equal');
                    assert.notOk(_.isEqual(12564504e5, new Date(2009, 9, 25)), 'Dates and their corresponding numeric primitive values are not equal');

                    // Dates.
                    assert.ok(_.isEqual(new Date(2009, 9, 25), new Date(2009, 9, 25)), 'Date objects referencing identical times are equal');
                    assert.notOk(_.isEqual(new Date(2009, 9, 25), new Date(2009, 11, 13)), 'Date objects referencing different times are not equal');
                    assert.notOk(_.isEqual(new Date(2009, 11, 13), {
                        getTime: function(){
                            return 12606876e5;
                        }
                    }), 'Date objects and objects with a `getTime` method are not equal');
                    assert.notOk(_.isEqual(new Date('Curly'), new Date('Curly')), 'Invalid dates are not equal');

                    // Functions.
                    assert.notOk(_.isEqual(First, Second), 'Different functions with identical bodies and source code representations are not equal');

                    // RegExps.
                    assert.ok(_.isEqual(/(?:)/gim, /(?:)/gim), 'RegExps with equivalent patterns and flags are equal');
                    assert.ok(_.isEqual(/(?:)/gi, /(?:)/ig), 'Flag order is not significant');
                    assert.notOk(_.isEqual(/(?:)/g, /(?:)/gi), 'RegExps with equivalent patterns and different flags are not equal');
                    assert.notOk(_.isEqual(/Moe/gim, /Curly/gim), 'RegExps with different patterns and equivalent flags are not equal');
                    assert.notOk(_.isEqual(/(?:)/gi, /(?:)/g), 'Commutative equality is implemented for RegExps');
                    assert.notOk(_.isEqual(/Curly/g, {source: 'Larry', global: true, ignoreCase: false, multiline: false}), 'RegExps and RegExp-like objects are not equal');

                    // Empty arrays, array-like objects, and object literals.
                    assert.ok(_.isEqual({}, {}), 'Empty object literals are equal');
                    assert.ok(_.isEqual([], []), 'Empty array literals are equal');
                    assert.ok(_.isEqual([{}], [{}]), 'Empty nested arrays and objects are equal');
                    assert.notOk(_.isEqual({length: 0}, []), 'Array-like objects and arrays are not equal.');
                    assert.notOk(_.isEqual([], {length: 0}), 'Commutative equality is implemented for array-like objects');

                    assert.notOk(_.isEqual({}, []), 'Object literals and array literals are not equal');
                    assert.notOk(_.isEqual([], {}), 'Commutative equality is implemented for objects and arrays');

                    // Arrays with primitive and object values.
                    assert.ok(_.isEqual([1, 'Larry', true], [1, 'Larry', true]), 'Arrays containing identical primitives are equal');
                    assert.ok(_.isEqual([/Moe/g, new Date(2009, 9, 25)], [/Moe/g, new Date(2009, 9, 25)]), 'Arrays containing equivalent elements are equal');

                    // Multi-dimensional arrays.
                    var a = [new Number(47), false, 'Larry', /Moe/, new Date(2009, 11, 13), ['running', 'biking', new String('programming')], {a: 47}];
                    var b = [new Number(47), false, 'Larry', /Moe/, new Date(2009, 11, 13), ['running', 'biking', new String('programming')], {a: 47}];
                    assert.ok(_.isEqual(a, b), 'Arrays containing nested arrays and objects are recursively compared');

                    // Overwrite the methods defined in ES 5.1 section 15.4.4.
                    a.forEach = a.map = a.filter = a.every = a.indexOf = a.lastIndexOf = a.some = a.reduce = a.reduceRight = null;
                    b.join = b.pop = b.reverse = b.shift = b.slice = b.splice = b.concat = b.sort = b.unshift = null;

                    // Array elements and properties.
                    assert.ok(_.isEqual(a, b), 'Arrays containing equivalent elements and different non-numeric properties are equal');
                    a.push('White Rocks');
                    assert.notOk(_.isEqual(a, b), 'Arrays of different lengths are not equal');
                    a.push('East Boulder');
                    b.push('Gunbarrel Ranch', 'Teller Farm');
                    assert.notOk(_.isEqual(a, b), 'Arrays of identical lengths containing different elements are not equal');

                    // Sparse arrays.
                    assert.ok(_.isEqual(Array(3), Array(3)), 'Sparse arrays of identical lengths are equal');
                    assert.notOk(_.isEqual(Array(3), Array(6)), 'Sparse arrays of different lengths are not equal when both are empty');

                    var sparse = [];
                    sparse[1] = 5;
                    assert.ok(_.isEqual(sparse, [void 0, 5]), 'Handles sparse arrays as dense');

                    // Simple objects.
                    assert.ok(_.isEqual({a: 'Curly', b: 1, c: true}, {a: 'Curly', b: 1, c: true}), 'Objects containing identical primitives are equal');
                    assert.ok(_.isEqual({a: /Curly/g, b: new Date(2009, 11, 13)}, {a: /Curly/g, b: new Date(2009, 11, 13)}), 'Objects containing equivalent members are equal');
                    assert.notOk(_.isEqual({a: 63, b: 75}, {a: 61, b: 55}), 'Objects of identical sizes with different values are not equal');
                    assert.notOk(_.isEqual({a: 63, b: 75}, {a: 61, c: 55}), 'Objects of identical sizes with different property names are not equal');
                    assert.notOk(_.isEqual({a: 1, b: 2}, {a: 1}), 'Objects of different sizes are not equal');
                    assert.notOk(_.isEqual({a: 1}, {a: 1, b: 2}), 'Commutative equality is implemented for objects');
                    assert.notOk(_.isEqual({x: 1, y: void 0}, {x: 1, z: 2}), 'Objects with identical keys and different values are not equivalent');

                    // `A` contains nested objects and arrays.
                    a = {
                        name: new String('Moe Howard'),
                        age: new Number(77),
                        stooge: true,
                        hobbies: ['acting'],
                        film: {
                            name: 'Sing a Song of Six Pants',
                            release: new Date(1947, 9, 30),
                            stars: [new String('Larry Fine'), 'Shemp Howard'],
                            minutes: new Number(16),
                            seconds: 54
                        }
                    };

                    // `B` contains equivalent nested objects and arrays.
                    b = {
                        name: new String('Moe Howard'),
                        age: new Number(77),
                        stooge: true,
                        hobbies: ['acting'],
                        film: {
                            name: 'Sing a Song of Six Pants',
                            release: new Date(1947, 9, 30),
                            stars: [new String('Larry Fine'), 'Shemp Howard'],
                            minutes: new Number(16),
                            seconds: 54
                        }
                    };
                    assert.ok(_.isEqual(a, b), 'Objects with nested equivalent members are recursively compared');

                    // Instances.
                    assert.ok(_.isEqual(new First, new First), 'Object instances are equal');
                    assert.notOk(_.isEqual(new First, new Second), 'Objects with different constructors and identical own properties are not equal');
                    assert.notOk(_.isEqual({value: 1}, new First), 'Object instances and objects sharing equivalent properties are not equal');
                    assert.notOk(_.isEqual({value: 2}, new Second), 'The prototype chain of objects should not be examined');

                    // Circular Arrays.
                    (a = []).push(a);
                    (b = []).push(b);
                    assert.ok(_.isEqual(a, b), 'Arrays containing circular references are equal');
                    a.push(new String('Larry'));
                    b.push(new String('Larry'));
                    assert.ok(_.isEqual(a, b), 'Arrays containing circular references and equivalent properties are equal');
                    a.push('Shemp');
                    b.push('Curly');
                    assert.notOk(_.isEqual(a, b), 'Arrays containing circular references and different properties are not equal');

                    // More circular arrays #767.
                    a = ['everything is checked but', 'this', 'is not'];
                    a[1] = a;
                    b = ['everything is checked but', ['this', 'array'], 'is not'];
                    assert.notOk(_.isEqual(a, b), 'Comparison of circular references with non-circular references are not equal');

                    // Circular Objects.
                    a = {abc: null};
                    b = {abc: null};
                    a.abc = a;
                    b.abc = b;
                    assert.ok(_.isEqual(a, b), 'Objects containing circular references are equal');
                    a.def = 75;
                    b.def = 75;
                    assert.ok(_.isEqual(a, b), 'Objects containing circular references and equivalent properties are equal');
                    a.def = new Number(75);
                    b.def = new Number(63);
                    assert.notOk(_.isEqual(a, b), 'Objects containing circular references and different properties are not equal');

                    // More circular objects #767.
                    a = {everything: 'is checked', but: 'this', is: 'not'};
                    a.but = a;
                    b = {everything: 'is checked', but: {that: 'object'}, is: 'not'};
                    assert.notOk(_.isEqual(a, b), 'Comparison of circular references with non-circular object references are not equal');

                    // Cyclic Structures.
                    a = [{abc: null}];
                    b = [{abc: null}];
                    (a[0].abc = a).push(a);
                    (b[0].abc = b).push(b);
                    assert.ok(_.isEqual(a, b), 'Cyclic structures are equal');
                    a[0].def = 'Larry';
                    b[0].def = 'Larry';
                    assert.ok(_.isEqual(a, b), 'Cyclic structures containing equivalent properties are equal');
                    a[0].def = new String('Larry');
                    b[0].def = new String('Curly');
                    assert.notOk(_.isEqual(a, b), 'Cyclic structures containing different properties are not equal');

                    // Complex Circular References.
                    a = {foo: {b: {foo: {c: {foo: null}}}}};
                    b = {foo: {b: {foo: {c: {foo: null}}}}};
                    a.foo.b.foo.c.foo = a;
                    b.foo.b.foo.c.foo = b;
                    assert.ok(_.isEqual(a, b), 'Cyclic structures with nested and identically-named properties are equal');

                    // Chaining.
                    assert.notOk(_.isEqual(_({x: 1, y: void 0}).chain(), _({x: 1, z: 2}).chain()), 'Chained objects containing different values are not equal');

                    a = _({x: 1, y: 2}).chain();
                    b = _({x: 1, y: 2}).chain();
                    assert.strictEqual(_.isEqual(a.isEqual(b), _(true)), true, '`isEqual` can be chained');

                    // Objects without a `constructor` property
                    if (Object.create) {
                        a = Object.create(null, {x: {value: 1, enumerable: true}});
                        b = {x: 1};
                        assert.ok(_.isEqual(a, b), 'Handles objects without a constructor (e.g. from Object.create');
                    }

                    function Foo() { this.a = 1; }
                    Foo.prototype.constructor = null;

                    var other = {a: 1};
                    assert.strictEqual(_.isEqual(new Foo, other), false, 'Objects from different constructors are not equal');

                    // Tricky object cases val comparisons
                    assert.strictEqual(_.isEqual([0], [-0]), false);
                    assert.strictEqual(_.isEqual({a: 0}, {a: -0}), false);
                    assert.strictEqual(_.isEqual([NaN], [NaN]), true);
                    assert.strictEqual(_.isEqual({a: NaN}, {a: NaN}), true);

                    if (typeof Symbol !== 'undefined') {
                        var symbol = Symbol('x');
                        assert.strictEqual(_.isEqual(symbol, symbol), true, 'A symbol is equal to itself');
                        assert.strictEqual(_.isEqual(symbol, Object(symbol)), true, 'Even when wrapped in Object()');
                        assert.strictEqual(_.isEqual(symbol, null), false, 'Different types are not equal');

                        var symbolY = Symbol('y');
                        assert.strictEqual(_.isEqual(symbol, symbolY), false, 'Different symbols are not equal');

                        var sameStringSymbol = Symbol('x');
                        assert.strictEqual(_.isEqual(symbol, sameStringSymbol), false, 'Different symbols of same string are not equal');
                    }
                });

                QUnit.test('isEmpty', function(assert) {
                    assert.notOk(_([1]).isEmpty(), '[1] is not empty');
                    assert.ok(_.isEmpty([]), '[] is empty');
                    assert.notOk(_.isEmpty({one: 1}), '{one: 1} is not empty');
                    assert.ok(_.isEmpty({}), '{} is empty');
                    assert.ok(_.isEmpty(new RegExp('')), 'objects with prototype properties are empty');
                    assert.ok(_.isEmpty(null), 'null is empty');
                    assert.ok(_.isEmpty(), 'undefined is empty');
                    assert.ok(_.isEmpty(''), 'the empty string is empty');
                    assert.notOk(_.isEmpty('moe'), 'but other strings are not');

                    var obj = {one: 1};
                    delete obj.one;
                    assert.ok(_.isEmpty(obj), 'deleting all the keys from an object empties it');

                    var args = function(){ return arguments; };
                    assert.ok(_.isEmpty(args()), 'empty arguments object is empty');
                    assert.notOk(_.isEmpty(args('')), 'non-empty arguments object is not empty');

                    // covers collecting non-enumerable properties in IE < 9
                    var nonEnumProp = {toString: 5};
                    assert.notOk(_.isEmpty(nonEnumProp), 'non-enumerable property is not empty');
                });

                QUnit.test('isArguments', function(assert) {
                    var args = (function(){ return arguments; }(1, 2, 3));
                    assert.notOk(_.isArguments('string'), 'a string is not an arguments object');
                    assert.notOk(_.isArguments(_.isArguments), 'a function is not an arguments object');
                    assert.ok(_.isArguments(args), 'but the arguments object is an arguments object');
                    assert.notOk(_.isArguments(_.toArray(args)), 'but not when it\'s converted into an array');
                    assert.notOk(_.isArguments([1, 2, 3]), 'and not vanilla arrays.');
                });

                QUnit.test('isObject', function(assert) {
                    assert.ok(_.isObject(arguments), 'the arguments object is object');
                    assert.ok(_.isObject([1, 2, 3]), 'and arrays');
                    assert.ok(_.isObject(function() {}), 'and functions');
                    assert.notOk(_.isObject(null), 'but not null');
                    assert.notOk(_.isObject(void 0), 'and not undefined');
                    assert.notOk(_.isObject('string'), 'and not string');
                    assert.notOk(_.isObject(12), 'and not number');
                    assert.notOk(_.isObject(true), 'and not boolean');
                    assert.ok(_.isObject(new String('string')), 'but new String()');
                });

                QUnit.test('isArray', function(assert) {
                    assert.notOk(_.isArray(void 0), 'undefined vars are not arrays');
                    assert.notOk(_.isArray(arguments), 'the arguments object is not an array');
                    assert.ok(_.isArray([1, 2, 3]), 'but arrays are');
                });

                QUnit.test('isString', function(assert) {
                    var obj = new String('I am a string object');
                    assert.ok(_.isString([1, 2, 3].join(', ')), 'but strings are');
                    assert.strictEqual(_.isString('I am a string literal'), true, 'string literals are');
                    assert.ok(_.isString(obj), 'so are String objects');
                    assert.strictEqual(_.isString(1), false);
                });

                QUnit.test('isSymbol', function(assert) {
                    assert.notOk(_.isSymbol(0), 'numbers are not symbols');
                    assert.notOk(_.isSymbol(''), 'strings are not symbols');
                    assert.notOk(_.isSymbol(_.isSymbol), 'functions are not symbols');
                    if (typeof Symbol === 'function') {
                        assert.ok(_.isSymbol(Symbol()), 'symbols are symbols');
                        assert.ok(_.isSymbol(Symbol('description')), 'described symbols are symbols');
                        assert.ok(_.isSymbol(Object(Symbol())), 'boxed symbols are symbols');
                    }
                });
*/
        QUnit.test('isNumber', function(assert) {
          assert.notOk(_.isNumber('string'), 'a string is not a number')
          assert.notOk(_.isNumber(arguments), 'the arguments object is not a number')
          assert.notOk(_.isNumber(void 0), 'undefined is not a number')
          assert.ok(_.isNumber(3 * 4 - 7 / 10), 'but numbers are')
          assert.ok(_.isNumber(NaN), 'NaN *is* a number')
          assert.ok(_.isNumber(Infinity), 'Infinity is a number')
          assert.notOk(_.isNumber('1'), 'numeric strings are not numbers')
        })

        QUnit.test('isBoolean', function(assert) {
          assert.notOk(_.isBoolean(2), 'a number is not a boolean')
          assert.notOk(_.isBoolean('string'), 'a string is not a boolean')
          assert.notOk(_.isBoolean('false'), 'the string "false" is not a boolean')
          assert.notOk(_.isBoolean('true'), 'the string "true" is not a boolean')
          assert.notOk(_.isBoolean(arguments), 'the arguments object is not a boolean')
          assert.notOk(_.isBoolean(void 0), 'undefined is not a boolean')
          assert.notOk(_.isBoolean(NaN), 'NaN is not a boolean')
          assert.notOk(_.isBoolean(null), 'null is not a boolean')
          assert.ok(_.isBoolean(true), 'but true is')
          assert.ok(_.isBoolean(false), 'and so is false')
        })
        /*
                QUnit.test('isMap', function(assert) {
                    assert.notOk(_.isMap('string'), 'a string is not a map');
                    assert.notOk(_.isMap(2), 'a number is not a map');
                    assert.notOk(_.isMap({}), 'an object is not a map');
                    assert.notOk(_.isMap(false), 'a boolean is not a map');
                    assert.notOk(_.isMap(void 0), 'undefined is not a map');
                    assert.notOk(_.isMap([1, 2, 3]), 'an array is not a map');
                    if (typeof Set === 'function') {
                        assert.notOk(_.isMap(new Set()), 'a set is not a map');
                    }
                    if (typeof WeakSet === 'function') {
                        assert.notOk(_.isMap(new WeakSet()), 'a weakset is not a map');
                    }
                    if (typeof WeakMap === 'function') {
                        assert.notOk(_.isMap(new WeakMap()), 'a weakmap is not a map');
                    }
                    if (typeof Map === 'function') {
                        var keyString = 'a string';
                        var obj = new Map();
                        obj.set(keyString, 'value');
                        assert.ok(_.isMap(obj), 'but a map is');
                    }
                });

                QUnit.test('isWeakMap', function(assert) {
                    assert.notOk(_.isWeakMap('string'), 'a string is not a weakmap');
                    assert.notOk(_.isWeakMap(2), 'a number is not a weakmap');
                    assert.notOk(_.isWeakMap({}), 'an object is not a weakmap');
                    assert.notOk(_.isWeakMap(false), 'a boolean is not a weakmap');
                    assert.notOk(_.isWeakMap(void 0), 'undefined is not a weakmap');
                    assert.notOk(_.isWeakMap([1, 2, 3]), 'an array is not a weakmap');
                    if (typeof Set === 'function') {
                        assert.notOk(_.isWeakMap(new Set()), 'a set is not a weakmap');
                    }
                    if (typeof WeakSet === 'function') {
                        assert.notOk(_.isWeakMap(new WeakSet()), 'a weakset is not a weakmap');
                    }
                    if (typeof Map === 'function') {
                        assert.notOk(_.isWeakMap(new Map()), 'a map is not a weakmap');
                    }
                    if (typeof WeakMap === 'function') {
                        var keyObj = {}, obj = new WeakMap();
                        obj.set(keyObj, 'value');
                        assert.ok(_.isWeakMap(obj), 'but a weakmap is');
                    }
                });

                QUnit.test('isSet', function(assert) {
                    assert.notOk(_.isSet('string'), 'a string is not a set');
                    assert.notOk(_.isSet(2), 'a number is not a set');
                    assert.notOk(_.isSet({}), 'an object is not a set');
                    assert.notOk(_.isSet(false), 'a boolean is not a set');
                    assert.notOk(_.isSet(void 0), 'undefined is not a set');
                    assert.notOk(_.isSet([1, 2, 3]), 'an array is not a set');
                    if (typeof Map === 'function') {
                        assert.notOk(_.isSet(new Map()), 'a map is not a set');
                    }
                    if (typeof WeakMap === 'function') {
                        assert.notOk(_.isSet(new WeakMap()), 'a weakmap is not a set');
                    }
                    if (typeof WeakSet === 'function') {
                        assert.notOk(_.isSet(new WeakSet()), 'a weakset is not a set');
                    }
                    if (typeof Set === 'function') {
                        var obj = new Set();
                        obj.add(1).add('string').add(false).add({});
                        assert.ok(_.isSet(obj), 'but a set is');
                    }
                });

                QUnit.test('isWeakSet', function(assert) {

                    assert.notOk(_.isWeakSet('string'), 'a string is not a weakset');
                    assert.notOk(_.isWeakSet(2), 'a number is not a weakset');
                    assert.notOk(_.isWeakSet({}), 'an object is not a weakset');
                    assert.notOk(_.isWeakSet(false), 'a boolean is not a weakset');
                    assert.notOk(_.isWeakSet(void 0), 'undefined is not a weakset');
                    assert.notOk(_.isWeakSet([1, 2, 3]), 'an array is not a weakset');
                    if (typeof Map === 'function') {
                        assert.notOk(_.isWeakSet(new Map()), 'a map is not a weakset');
                    }
                    if (typeof WeakMap === 'function') {
                        assert.notOk(_.isWeakSet(new WeakMap()), 'a weakmap is not a weakset');
                    }
                    if (typeof Set === 'function') {
                        assert.notOk(_.isWeakSet(new Set()), 'a set is not a weakset');
                    }
                    if (typeof WeakSet === 'function') {
                        var obj = new WeakSet();
                        obj.add({x: 1}, {y: 'string'}).add({y: 'string'}).add({z: [1, 2, 3]});
                        assert.ok(_.isWeakSet(obj), 'but a weakset is');
                    }
                });
*/
        QUnit.test('isFunction', function(assert) {
          assert.notOk(_.isFunction(void 0), 'undefined vars are not functions')
          assert.notOk(_.isFunction([1, 2, 3]), 'arrays are not functions')
          assert.notOk(_.isFunction('moe'), 'strings are not functions')
          assert.ok(_.isFunction(_.isFunction), 'but functions are')
          assert.ok(_.isFunction(function() {}), 'even anonymous ones')
          var nodelist = typeof document !== 'undefined' && document.childNodes
          if (nodelist) {
            assert.notOk(_.isFunction(nodelist))
          }
        })

        if (typeof Int8Array !== 'undefined') {
          QUnit.test('#1929 Typed Array constructors are functions', function(assert) {
            _.chain(['Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Uint8Array', 'Uint8ClampedArray', 'Uint16Array', 'Uint32Array'])
              .map(_.propertyOf(Function('return this')()))
              .compact()
              .each(function(TypedArray) {
                // PhantomJS reports `typeof UInt8Array == 'object'` and doesn't report toString TypeArray
                // as a function
                assert.strictEqual(_.isFunction(TypedArray), Object.prototype.toString.call(TypedArray) === '[object Function]')
              })
          })
        }

        QUnit.test('isDate', function(assert) {
          assert.notOk(_.isDate(100), 'numbers are not dates')
          assert.notOk(_.isDate({}), 'objects are not dates')
          assert.ok(_.isDate(new Date()), 'but dates are')
        })

        QUnit.test('isRegExp', function(assert) {
          assert.notOk(_.isRegExp(_.identity), 'functions are not RegExps')
          assert.ok(_.isRegExp(/identity/), 'but RegExps are')
        })
        /*
                QUnit.test('isFinite', function(assert) {
                    assert.notOk(_.isFinite(void 0), 'undefined is not finite');
                    assert.notOk(_.isFinite(null), 'null is not finite');
                    assert.notOk(_.isFinite(NaN), 'NaN is not finite');
                    assert.notOk(_.isFinite(Infinity), 'Infinity is not finite');
                    assert.notOk(_.isFinite(-Infinity), '-Infinity is not finite');
                    assert.ok(_.isFinite('12'), 'Numeric strings are numbers');
                    assert.notOk(_.isFinite('1a'), 'Non numeric strings are not numbers');
                    assert.notOk(_.isFinite(''), 'Empty strings are not numbers');
                    var obj = new Number(5);
                    assert.ok(_.isFinite(obj), 'Number instances can be finite');
                    assert.ok(_.isFinite(0), '0 is finite');
                    assert.ok(_.isFinite(123), 'Ints are finite');
                    assert.ok(_.isFinite(-12.44), 'Floats are finite');
                    if (typeof Symbol === 'function') {
                        assert.notOk(_.isFinite(Symbol()), 'symbols are not numbers');
                        assert.notOk(_.isFinite(Symbol('description')), 'described symbols are not numbers');
                        assert.notOk(_.isFinite(Object(Symbol())), 'boxed symbols are not numbers');
                    }
                });
*/
        QUnit.test('isNaN', function(assert) {
          assert.notOk(_.isNaN(void 0), 'undefined is not NaN')
          assert.notOk(_.isNaN(null), 'null is not NaN')
          assert.notOk(_.isNaN(0), '0 is not NaN')
          assert.notOk(_.isNaN(new Number(0)), 'wrapped 0 is not NaN')
          assert.ok(_.isNaN(NaN), 'but NaN is')
          assert.ok(_.isNaN(new Number(NaN)), 'wrapped NaN is still NaN')
          if (typeof Symbol !== 'undefined') {
            assert.notOk(_.isNaN(Symbol()), 'symbol is not NaN')
          }
        })

        QUnit.test('isNull', function(assert) {
          assert.notOk(_.isNull(void 0), 'undefined is not null')
          assert.notOk(_.isNull(NaN), 'NaN is not null')
          assert.ok(_.isNull(null), 'but null is')
        })

        QUnit.test('isUndefined', function(assert) {
          assert.notOk(_.isUndefined(1), 'numbers are defined')
          assert.notOk(_.isUndefined(null), 'null is defined')
          assert.notOk(_.isUndefined(false), 'false is defined')
          assert.notOk(_.isUndefined(NaN), 'NaN is defined')
          assert.ok(_.isUndefined(), 'nothing is undefined')
          assert.ok(_.isUndefined(void 0), 'undefined is undefined')
        })

        QUnit.test('isError', function(assert) {
          assert.notOk(_.isError(1), 'numbers are not Errors')
          assert.notOk(_.isError(null), 'null is not an Error')
          assert.notOk(_.isError(Error), 'functions are not Errors')
          assert.ok(_.isError(new Error()), 'Errors are Errors')
          assert.ok(_.isError(new EvalError()), 'EvalErrors are Errors')
          assert.ok(_.isError(new RangeError()), 'RangeErrors are Errors')
          assert.ok(_.isError(new ReferenceError()), 'ReferenceErrors are Errors')
          assert.ok(_.isError(new SyntaxError()), 'SyntaxErrors are Errors')
          assert.ok(_.isError(new TypeError()), 'TypeErrors are Errors')
          assert.ok(_.isError(new URIError()), 'URIErrors are Errors')
        })

        QUnit.test('tap', function(assert) {
          var intercepted = null
          var interceptor = function(obj) { intercepted = obj }
          var returned = _.tap(1, interceptor)
          assert.strictEqual(intercepted, 1, 'passes tapped object to interceptor')
          assert.strictEqual(returned, 1, 'returns tapped object')

          returned = _([1, 2, 3]).chain()
            .map(function(n) { return n * 2 })
            .max()
            .tap(interceptor)
            .value()
          assert.strictEqual(returned, 6, 'can use tapped objects in a chain')
          assert.strictEqual(intercepted, returned, 'can use tapped objects in a chain')
        })

        QUnit.test('has', function(assert) {
          var obj = {foo: 'bar', func: function() {}}
          assert.ok(_.has(obj, 'foo'), 'checks that the object has a property.')
          assert.notOk(_.has(obj, 'baz'), "returns false if the object doesn't have the property.")
          assert.ok(_.has(obj, 'func'), 'works for functions too.')
          obj.hasOwnProperty = null
          assert.ok(_.has(obj, 'foo'), 'works even when the hasOwnProperty method is deleted.')
          var child = {}
          child.prototype = obj
          assert.notOk(_.has(child, 'foo'), 'does not check the prototype chain for a property.')
          assert.strictEqual(_.has(null, 'foo'), false, 'returns false for null')
          assert.strictEqual(_.has(void 0, 'foo'), false, 'returns false for undefined')

          assert.ok(_.has({a: {b: 'foo'}}, ['a', 'b']), 'can check for nested properties.')
          assert.notOk(_.has({a: child}, ['a', 'foo']), 'does not check the prototype of nested props.')
        })

        QUnit.test('property', function(assert) {
          var stooge = {name: 'moe'}
          assert.strictEqual(_.property('name')(stooge), 'moe', 'should return the property with the given name')
          assert.strictEqual(_.property('name')(null), void 0, 'should return undefined for null values')
          assert.strictEqual(_.property('name')(void 0), void 0, 'should return undefined for undefined values')
          assert.strictEqual(_.property(null)('foo'), void 0, 'should return undefined for null object')
          assert.strictEqual(_.property('x')({x: null}), null, 'can fetch null values')
          assert.strictEqual(_.property('length')(null), void 0, 'does not crash on property access of non-objects')

          // Deep property access
          assert.strictEqual(_.property('a')({a: 1}), 1, 'can get a direct property')
          assert.strictEqual(_.property(['a', 'b'])({a: {b: 2}}), 2, 'can get a nested property')
          assert.strictEqual(_.property(['a'])({a: false}), false, 'can fetch falsy values')
          assert.strictEqual(_.property(['x', 'y'])({x: {y: null}}), null, 'can fetch null values deeply')
          assert.strictEqual(_.property(['x', 'y'])({x: null}), void 0, 'does not crash on property access of nested non-objects')
          assert.strictEqual(_.property([])({x: 'y'}), void 0, 'returns `undefined` for a path that is an empty array')
        })

        QUnit.test('propertyOf', function(assert) {
          var stoogeRanks = _.propertyOf({curly: 2, moe: 1, larry: 3})
          assert.strictEqual(stoogeRanks('curly'), 2, 'should return the property with the given name')
          assert.strictEqual(stoogeRanks(null), void 0, 'should return undefined for null values')
          assert.strictEqual(stoogeRanks(void 0), void 0, 'should return undefined for undefined values')
          assert.strictEqual(_.propertyOf({a: null})('a'), null, 'can fetch null values')

          function MoreStooges() { this.shemp = 87 }
          MoreStooges.prototype = {curly: 2, moe: 1, larry: 3}
          var moreStoogeRanks = _.propertyOf(new MoreStooges())
          assert.strictEqual(moreStoogeRanks('curly'), 2, 'should return properties from further up the prototype chain')

          var nullPropertyOf = _.propertyOf(null)
          assert.strictEqual(nullPropertyOf('curly'), void 0, 'should return undefined when obj is null')

          var undefPropertyOf = _.propertyOf(void 0)
          assert.strictEqual(undefPropertyOf('curly'), void 0, 'should return undefined when obj is undefined')

          var deepPropertyOf = _.propertyOf({curly: {number: 2}, joe: {number: null}})
          assert.strictEqual(deepPropertyOf(['curly', 'number']), 2, 'can fetch nested properties of obj')
          assert.strictEqual(deepPropertyOf(['joe', 'number']), null, 'can fetch nested null properties of obj')
        })

        QUnit.test('isMatch', function(assert) {
          var moe = {name: 'Moe Howard', hair: true}
          var curly = {name: 'Curly Howard', hair: false}

          assert.strictEqual(_.isMatch(moe, {hair: true}), true, 'Returns a boolean')
          assert.strictEqual(_.isMatch(curly, {hair: true}), false, 'Returns a boolean')

          assert.strictEqual(_.isMatch(5, {__x__: void 0}), false, 'can match undefined props on primitives')
          assert.strictEqual(_.isMatch({__x__: void 0}, {__x__: void 0}), true, 'can match undefined props')

          assert.strictEqual(_.isMatch(null, {}), true, 'Empty spec called with null object returns true')
          assert.strictEqual(_.isMatch(null, {a: 1}), false, 'Non-empty spec called with null object returns false')

          _.each([null, void 0], function(item) { assert.strictEqual(_.isMatch(item, null), true, 'null matches null') })
          _.each([null, void 0], function(item) { assert.strictEqual(_.isMatch(item, null), true, 'null matches {}') })
          assert.strictEqual(_.isMatch({b: 1}, {a: void 0}), false, 'handles undefined values (1683)')

          _.each([true, 5, NaN, null, void 0], function(item) {
            assert.strictEqual(_.isMatch({a: 1}, item), true, 'treats primitives as empty')
          })

          function Prototest() {}
          Prototest.prototype.x = 1
          var specObj = new Prototest()
          assert.strictEqual(_.isMatch({x: 2}, specObj), true, 'spec is restricted to own properties')

          specObj.y = 5
          assert.strictEqual(_.isMatch({x: 1, y: 5}, specObj), true)
          assert.strictEqual(_.isMatch({x: 1, y: 4}, specObj), false)

          assert.ok(_.isMatch(specObj, {x: 1, y: 5}), 'inherited and own properties are checked on the test object')

          Prototest.x = 5
          assert.ok(_.isMatch({x: 5, y: 1}, Prototest), 'spec can be a function')

          // null edge cases
          var oCon = {constructor: Object}
          assert.deepEqual(_.map([null, void 0, 5, {}], _.partial(_.isMatch, _, oCon)), [false, false, false, true], 'doesnt falsy match constructor on undefined/null')
        })

        QUnit.test('matcher', function(assert) {
          var moe = {name: 'Moe Howard', hair: true}
          var curly = {name: 'Curly Howard', hair: false}
          var stooges = [moe, curly]

          assert.strictEqual(_.matcher({hair: true})(moe), true, 'Returns a boolean')
          assert.strictEqual(_.matcher({hair: true})(curly), false, 'Returns a boolean')

          assert.strictEqual(_.matcher({__x__: void 0})(5), false, 'can match undefined props on primitives')
          assert.strictEqual(_.matcher({__x__: void 0})({__x__: void 0}), true, 'can match undefined props')

          assert.strictEqual(_.matcher({})(null), true, 'Empty spec called with null object returns true')
          assert.strictEqual(_.matcher({a: 1})(null), false, 'Non-empty spec called with null object returns false')

          assert.strictEqual(_.find(stooges, _.matcher({hair: false})), curly, 'returns a predicate that can be used by finding functions.')
          assert.strictEqual(_.find(stooges, _.matcher(moe)), moe, 'can be used to locate an object exists in a collection.')
          assert.deepEqual(_.filter([null, void 0], _.matcher({a: 1})), [], 'Do not throw on null values.')

          assert.deepEqual(_.filter([null, void 0], _.matcher(null)), [null, void 0], 'null matches null')
          assert.deepEqual(_.filter([null, void 0], _.matcher({})), [null, void 0], 'null matches {}')
          assert.deepEqual(_.filter([{b: 1}], _.matcher({a: void 0})), [], 'handles undefined values (1683)')

          _.each([true, 5, NaN, null, void 0], function(item) {
            assert.strictEqual(_.matcher(item)({a: 1}), true, 'treats primitives as empty')
          })

          function Prototest() {}
          Prototest.prototype.x = 1
          var specObj = new Prototest()
          var protospec = _.matcher(specObj)
          assert.strictEqual(protospec({x: 2}), true, 'spec is restricted to own properties')

          specObj.y = 5
          protospec = _.matcher(specObj)
          assert.strictEqual(protospec({x: 1, y: 5}), true)
          assert.strictEqual(protospec({x: 1, y: 4}), false)

          assert.ok(_.matcher({x: 1, y: 5})(specObj), 'inherited and own properties are checked on the test object')

          Prototest.x = 5
          assert.ok(_.matcher(Prototest)({x: 5, y: 1}), 'spec can be a function')

          // #1729
          var o = {b: 1}
          var m = _.matcher(o)

          assert.strictEqual(m({b: 1}), true)
          o.b = 2
          o.a = 1
          assert.strictEqual(m({b: 1}), true, 'changing spec object doesnt change matches result')

          // null edge cases
          var oCon = _.matcher({constructor: Object})
          assert.deepEqual(_.map([null, void 0, 5, {}], oCon), [false, false, false, true], 'doesnt falsy match constructor on undefined/null')
        })

        QUnit.test('matches', function(assert) {
          assert.strictEqual(_.matches, _.matcher, 'is an alias for matcher')
        })

        QUnit.test('findKey', function(assert) {
          var objects = {
            a: {a: 0, b: 0},
            b: {a: 1, b: 1},
            c: {a: 2, b: 2}
          }

          assert.strictEqual(_.findKey(objects, function(obj) {
            return obj.a === 0
          }), 'a')

          assert.strictEqual(_.findKey(objects, function(obj) {
            return obj.b * obj.a === 4
          }), 'c')

          assert.strictEqual(_.findKey(objects, 'a'), 'b', 'Uses lookupIterator')

          assert.strictEqual(_.findKey(objects, function(obj) {
            return obj.b * obj.a === 5
          }), void 0)

          assert.strictEqual(_.findKey([1, 2, 3, 4, 5, 6], function(obj) {
            return obj === 3
          }), '2', 'Keys are strings')

          assert.strictEqual(_.findKey(objects, function(a) {
            return a.foo === null
          }), void 0)

          _.findKey({a: {a: 1}}, function(a, key, obj) {
            assert.strictEqual(key, 'a')
            assert.deepEqual(obj, {a: {a: 1}})
            assert.strictEqual(this, objects, 'called with context')
          }, objects)

          var array = [1, 2, 3, 4]
          array.match = 55
          assert.strictEqual(_.findKey(array, function(x) { return x === 55 }), 'match', 'matches array-likes keys')
        })

        QUnit.test('mapObject', function(assert) {
          var obj = {a: 1, b: 2}
          var objects = {
            a: {a: 0, b: 0},
            b: {a: 1, b: 1},
            c: {a: 2, b: 2}
          }

          assert.deepEqual(_.mapObject(obj, function(val) {
            return val * 2
          }), {a: 2, b: 4}, 'simple objects')

          assert.deepEqual(_.mapObject(objects, function(val) {
            return _.reduce(val, function(memo, v) {
              return memo + v
            }, 0)
          }), {a: 0, b: 2, c: 4}, 'nested objects')

          assert.deepEqual(_.mapObject(obj, function(val, key, o) {
            return o[key] * 2
          }), {a: 2, b: 4}, 'correct keys')

          assert.deepEqual(_.mapObject([1, 2], function(val) {
            return val * 2
          }), {0: 2, 1: 4}, 'check behavior for arrays')

          assert.deepEqual(_.mapObject(obj, function(val) {
            return val * this.multiplier
          }, {multiplier: 3}), {a: 3, b: 6}, 'keep context')

          assert.deepEqual(_.mapObject({a: 1}, function() {
            return this.length
          }, [1, 2]), {a: 2}, 'called with context')

          var ids = _.mapObject({length: 2, 0: {id: '1'}, 1: {id: '2'}}, function(n) {
            return n.id
          })
          assert.deepEqual(ids, {length: void 0, 0: '1', 1: '2'}, 'Check with array-like objects')

          // Passing a property name like _.pluck.
          var people = {a: {name: 'moe', age: 30}, b: {name: 'curly', age: 50}}
          assert.deepEqual(_.mapObject(people, 'name'), {a: 'moe', b: 'curly'}, 'predicate string map to object properties')

          _.each([null, void 0, 1, 'abc', [], {}, void 0], function(val) {
            assert.deepEqual(_.mapObject(val, _.identity), {}, 'mapValue identity')
          })

          var Proto = function() { this.a = 1 }
          Proto.prototype.b = 1
          var protoObj = new Proto()
          assert.deepEqual(_.mapObject(protoObj, _.identity), {a: 1}, 'ignore inherited values from prototypes')

        })

      }
    }))

    it('Utility', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('underscore')

      registerTests()

      var failures = []

      QUnit.testDone(function(details) {
        if (details.failed) {
          failures = failures.concat(details.assertions.filter(function(v) { return !v.result }).map(function(v) { return { name: details.module + '.' + details.name, message: v.message} }))
        }
      })

      QUnit.start()

      if (failures.length) {
        throw {
          code: 'kError',
          reason: '1 or more tests failed.',
          faults: failures
        }
      }

      function registerTests() {

        var templateSettings

        QUnit.module('Utility', {

          beforeEach: function() {
            templateSettings = _.clone(_.templateSettings)
          },

          afterEach: function() {
            _.templateSettings = templateSettings
          }

        })

        QUnit.test('#750 - Return _ instance.', function(assert) {
          assert.expect(2)
          var instance = _([])
          assert.strictEqual(_(instance), instance)
          assert.strictEqual(new _(instance), instance)
        })

        QUnit.test('identity', function(assert) {
          var stooge = {name: 'moe'}
          assert.strictEqual(_.identity(stooge), stooge, 'stooge is the same as his identity')
        })

        QUnit.test('constant', function(assert) {
          var stooge = {name: 'moe'}
          assert.strictEqual(_.constant(stooge)(), stooge, 'should create a function that returns stooge')
        })

        QUnit.test('noop', function(assert) {
          assert.strictEqual(_.noop('curly', 'larry', 'moe'), void 0, 'should always return undefined')
        })

        QUnit.test('random', function(assert) {
          var array = _.range(1000)
          var min = Math.pow(2, 31)
          var max = Math.pow(2, 62)

          assert.ok(_.every(array, function() {
            return _.random(min, max) >= min
          }), 'should produce a random number greater than or equal to the minimum number')

          assert.ok(_.some(array, function() {
            return _.random(Number.MAX_VALUE) > 0
          }), 'should produce a random number when passed `Number.MAX_VALUE`')
        })

        QUnit.test('now', function(assert) {
          var diff = _.now() - new Date().getTime()
          assert.ok(diff <= 0 && diff > -5, 'Produces the correct time in milliseconds')// within 5ms
        })

        QUnit.test('uniqueId', function(assert) {
          var ids = [], i = 0
          while (i++ < 100) ids.push(_.uniqueId())
          assert.strictEqual(_.uniq(ids).length, ids.length, 'can generate a globally-unique stream of ids')
        })

        QUnit.test('times', function(assert) {
          var vals = []
          _.times(3, function(i) { vals.push(i) })
          assert.deepEqual(vals, [0, 1, 2], 'is 0 indexed')
          //
          vals = []
          _(3).times(function(i) { vals.push(i) })
          assert.deepEqual(vals, [0, 1, 2], 'works as a wrapper')
          // collects return values
          assert.deepEqual([0, 1, 2], _.times(3, function(i) { return i }), 'collects return values')

          assert.deepEqual(_.times(0, _.identity), [])
          assert.deepEqual(_.times(-1, _.identity), [])
          assert.deepEqual(_.times(parseFloat('-Infinity'), _.identity), [])
        })

        QUnit.test('mixin', function(assert) {
          var ret = _.mixin({
            myReverse: function(string) {
              return string.split('').reverse().join('')
            }
          })
          assert.strictEqual(ret, _, 'returns the _ object to facilitate chaining')
          assert.strictEqual(_.myReverse('panacea'), 'aecanap', 'mixed in a function to _')
          assert.strictEqual(_('champ').myReverse(), 'pmahc', 'mixed in a function to the OOP wrapper')
        })

        QUnit.test('_.escape', function(assert) {
          assert.strictEqual(_.escape(null), '')
        })

        QUnit.test('_.unescape', function(assert) {
          var string = 'Curly & Moe'
          assert.strictEqual(_.unescape(null), '')
          assert.strictEqual(_.unescape(_.escape(string)), string)
          assert.strictEqual(_.unescape(string), string, 'don\'t unescape unnecessarily')
        })

        // Don't care what they escape them to just that they're escaped and can be unescaped
        QUnit.test('_.escape & unescape', function(assert) {
          // test & (&amp;) separately obviously
          var escapeCharacters = ['<', '>', '"', '\'', '`']

          _.each(escapeCharacters, function(escapeChar) {
            var s = 'a ' + escapeChar + ' string escaped'
            var e = _.escape(s)
            assert.notEqual(s, e, escapeChar + ' is escaped')
            assert.strictEqual(s, _.unescape(e), escapeChar + ' can be unescaped')

            s = 'a ' + escapeChar + escapeChar + escapeChar + 'some more string' + escapeChar
            e = _.escape(s)

            assert.strictEqual(e.indexOf(escapeChar), -1, 'can escape multiple occurrences of ' + escapeChar)
            assert.strictEqual(_.unescape(e), s, 'multiple occurrences of ' + escapeChar + ' can be unescaped')
          })

          // handles multiple escape characters at once
          var joiner = ' other stuff '
          var allEscaped = escapeCharacters.join(joiner)
          allEscaped += allEscaped
          assert.ok(_.every(escapeCharacters, function(escapeChar) {
            return allEscaped.indexOf(escapeChar) !== -1
          }), 'handles multiple characters')
          assert.ok(allEscaped.indexOf(joiner) >= 0, 'can escape multiple escape characters at the same time')

          // test & -> &amp;
          var str = 'some string & another string & yet another'
          var escaped = _.escape(str)

          assert.notStrictEqual(escaped.indexOf('&'), -1, 'handles & aka &amp;')
          assert.strictEqual(_.unescape(str), str, 'can unescape &amp;')
        })

        QUnit.test('template', function(assert) {
          var basicTemplate = _.template("<%= thing %> is gettin' on my noives!")
          var result = basicTemplate({thing: 'This'})
          assert.strictEqual(result, "This is gettin' on my noives!", 'can do basic attribute interpolation')

          var sansSemicolonTemplate = _.template('A <% this %> B')
          assert.strictEqual(sansSemicolonTemplate(), 'A  B')

          var backslashTemplate = _.template('<%= thing %> is \\ridanculous')
          assert.strictEqual(backslashTemplate({thing: 'This'}), 'This is \\ridanculous')

          var escapeTemplate = _.template('<%= a ? "checked=\\"checked\\"" : "" %>')
          assert.strictEqual(escapeTemplate({a: true}), 'checked="checked"', 'can handle slash escapes in interpolations.')

          var fancyTemplate = _.template('<ul><% ' +
                        '  for (var key in people) { ' +
                        '%><li><%= people[key] %></li><% } %></ul>')
          result = fancyTemplate({people: {moe: 'Moe', larry: 'Larry', curly: 'Curly'}})
          assert.strictEqual(result, '<ul><li>Moe</li><li>Larry</li><li>Curly</li></ul>', 'can run arbitrary javascript in templates')

          var escapedCharsInJavaScriptTemplate = _.template('<ul><% _.each(numbers.split("\\n"), function(item) { %><li><%= item %></li><% }) %></ul>')
          result = escapedCharsInJavaScriptTemplate({numbers: 'one\ntwo\nthree\nfour'})
          assert.strictEqual(result, '<ul><li>one</li><li>two</li><li>three</li><li>four</li></ul>', 'Can use escaped characters (e.g. \\n) in JavaScript')

          var namespaceCollisionTemplate = _.template('<%= pageCount %> <%= thumbnails[pageCount] %> <% _.each(thumbnails, function(p) { %><div class="thumbnail" rel="<%= p %>"></div><% }); %>')
          result = namespaceCollisionTemplate({
            pageCount: 3,
            thumbnails: {
              1: 'p1-thumbnail.gif',
              2: 'p2-thumbnail.gif',
              3: 'p3-thumbnail.gif'
            }
          })
          assert.strictEqual(result, '3 p3-thumbnail.gif <div class="thumbnail" rel="p1-thumbnail.gif"></div><div class="thumbnail" rel="p2-thumbnail.gif"></div><div class="thumbnail" rel="p3-thumbnail.gif"></div>')

          var noInterpolateTemplate = _.template('<div><p>Just some text. Hey, I know this is silly but it aids consistency.</p></div>')
          result = noInterpolateTemplate()
          assert.strictEqual(result, '<div><p>Just some text. Hey, I know this is silly but it aids consistency.</p></div>')

          var quoteTemplate = _.template("It's its, not it's")
          assert.strictEqual(quoteTemplate({}), "It's its, not it's")

          var quoteInStatementAndBody = _.template('<% ' +
                        "  if(foo == 'bar'){ " +
                        "%>Statement quotes and 'quotes'.<% } %>")
          assert.strictEqual(quoteInStatementAndBody({foo: 'bar'}), "Statement quotes and 'quotes'.")

          var withNewlinesAndTabs = _.template('This\n\t\tis: <%= x %>.\n\tok.\nend.')
          assert.strictEqual(withNewlinesAndTabs({x: 'that'}), 'This\n\t\tis: that.\n\tok.\nend.')

          var template = _.template('<i><%- value %></i>')
          result = template({value: '<script>'})
          assert.strictEqual(result, '<i>&lt;script&gt;</i>')

          var stooge = {
            name: 'Moe',
            template: _.template("I'm <%= this.name %>")
          }
          assert.strictEqual(stooge.template(), "I'm Moe")

          template = _.template('\n ' +
                        '  <%\n ' +
                        '  // a comment\n ' +
                        '  if (data) { data += 12345; }; %>\n ' +
                        '  <li><%= data %></li>\n '
          )
          assert.strictEqual(template({data: 12345}).replace(/\s/g, ''), '<li>24690</li>')

          _.templateSettings = {
            evaluate: /\{\{([\s\S]+?)\}\}/g,
            interpolate: /\{\{=([\s\S]+?)\}\}/g
          }

          var custom = _.template('<ul>{{ for (var key in people) { }}<li>{{= people[key] }}</li>{{ } }}</ul>')
          result = custom({people: {moe: 'Moe', larry: 'Larry', curly: 'Curly'}})
          assert.strictEqual(result, '<ul><li>Moe</li><li>Larry</li><li>Curly</li></ul>', 'can run arbitrary javascript in templates')

          var customQuote = _.template("It's its, not it's")
          assert.strictEqual(customQuote({}), "It's its, not it's")

          quoteInStatementAndBody = _.template("{{ if(foo == 'bar'){ }}Statement quotes and 'quotes'.{{ } }}")
          assert.strictEqual(quoteInStatementAndBody({foo: 'bar'}), "Statement quotes and 'quotes'.")

          _.templateSettings = {
            evaluate: /<\?([\s\S]+?)\?>/g,
            interpolate: /<\?=([\s\S]+?)\?>/g
          }

          var customWithSpecialChars = _.template('<ul><? for (var key in people) { ?><li><?= people[key] ?></li><? } ?></ul>')
          result = customWithSpecialChars({people: {moe: 'Moe', larry: 'Larry', curly: 'Curly'}})
          assert.strictEqual(result, '<ul><li>Moe</li><li>Larry</li><li>Curly</li></ul>', 'can run arbitrary javascript in templates')

          var customWithSpecialCharsQuote = _.template("It's its, not it's")
          assert.strictEqual(customWithSpecialCharsQuote({}), "It's its, not it's")

          quoteInStatementAndBody = _.template("<? if(foo == 'bar'){ ?>Statement quotes and 'quotes'.<? } ?>")
          assert.strictEqual(quoteInStatementAndBody({foo: 'bar'}), "Statement quotes and 'quotes'.")

          _.templateSettings = {
            interpolate: /\{\{(.+?)\}\}/g
          }

          var mustache = _.template('Hello {{planet}}!')
          assert.strictEqual(mustache({planet: 'World'}), 'Hello World!', 'can mimic mustache.js')

          var templateWithNull = _.template('a null undefined {{planet}}')
          assert.strictEqual(templateWithNull({planet: 'world'}), 'a null undefined world', 'can handle missing escape and evaluate settings')
        })

        QUnit.test('_.template provides the generated function source, when a SyntaxError occurs', function(assert) {
          var source
          try {
            _.template('<b><%= if x %></b>')
          } catch (ex) {
            source = ex.source
          }
          assert.ok(/__p/.test(source))
        })

        QUnit.test('_.template handles \\u2028 & \\u2029', function(assert) {
          var tmpl = _.template('<p>\u2028<%= "\\u2028\\u2029" %>\u2029</p>')
          assert.strictEqual(tmpl(), '<p>\u2028\u2028\u2029\u2029</p>')
        })

        QUnit.test('result calls functions and returns primitives', function(assert) {
          var obj = {w: '', x: 'x', y: function() { return this.x }}
          assert.strictEqual(_.result(obj, 'w'), '')
          assert.strictEqual(_.result(obj, 'x'), 'x')
          assert.strictEqual(_.result(obj, 'y'), 'x')
          assert.strictEqual(_.result(obj, 'z'), void 0)
          assert.strictEqual(_.result(null, 'x'), void 0)
        })

        QUnit.test('result returns a default value if object is null or undefined', function(assert) {
          assert.strictEqual(_.result(null, 'b', 'default'), 'default')
          assert.strictEqual(_.result(void 0, 'c', 'default'), 'default')
          assert.strictEqual(_.result(''.match('missing'), 1, 'default'), 'default')
        })

        QUnit.test('result returns a default value if property of object is missing', function(assert) {
          assert.strictEqual(_.result({d: null}, 'd', 'default'), null)
          assert.strictEqual(_.result({e: false}, 'e', 'default'), false)
        })

        QUnit.test('result only returns the default value if the object does not have the property or is undefined', function(assert) {
          assert.strictEqual(_.result({}, 'b', 'default'), 'default')
          assert.strictEqual(_.result({d: void 0}, 'd', 'default'), 'default')
        })

        QUnit.test('result does not return the default if the property of an object is found in the prototype', function(assert) {
          var Foo = function() {}
          Foo.prototype.bar = 1
          assert.strictEqual(_.result(new Foo(), 'bar', 2), 1)
        })

        QUnit.test('result does use the fallback when the result of invoking the property is undefined', function(assert) {
          var obj = {a: function() {}}
          assert.strictEqual(_.result(obj, 'a', 'failed'), void 0)
        })

        QUnit.test('result fallback can use a function', function(assert) {
          var obj = {a: [1, 2, 3]}
          assert.strictEqual(_.result(obj, 'b', _.constant(5)), 5)
          assert.strictEqual(_.result(obj, 'b', function() {
            return this.a
          }), obj.a, 'called with context')
        })

        QUnit.test('result can accept an array of properties for deep access', function(assert) {
          var func = function() { return 'f' }
          var context = function() { return this }

          assert.strictEqual(_.result({a: 1}, 'a'), 1, 'can get a direct property')
          assert.strictEqual(_.result({a: {b: 2}}, ['a', 'b']), 2, 'can get a nested property')
          assert.strictEqual(_.result({a: 1}, 'b', 2), 2, 'uses the fallback value when property is missing')
          assert.strictEqual(_.result({a: 1}, ['b', 'c'], 2), 2, 'uses the fallback value when any property is missing')
          assert.strictEqual(_.result({a: void 0}, ['a'], 1), 1, 'uses the fallback when value is undefined')
          assert.strictEqual(_.result({a: false}, ['a'], 'foo'), false, 'can fetch falsy values')

          assert.strictEqual(_.result({a: func}, 'a'), 'f', 'can get a direct method')
          assert.strictEqual(_.result({a: {b: func}}, ['a', 'b']), 'f', 'can get a nested method')
          assert.strictEqual(_.result(), void 0, 'returns undefined if obj is not passed')
          assert.strictEqual(_.result(void 1, 'a', 2), 2, 'returns default if obj is not passed')
          assert.strictEqual(_.result(void 1, 'a', func), 'f', 'executes default if obj is not passed')
          assert.strictEqual(_.result({}, void 0, 2), 2, 'returns default if prop is not passed')
          assert.strictEqual(_.result({}, void 0, func), 'f', 'executes default if prop is not passed')

          var childObj = {c: context}
          var obj = {a: context, b: childObj}
          assert.strictEqual(_.result(obj, 'a'), obj, 'uses the parent object as context')
          assert.strictEqual(_.result(obj, 'e', context), obj, 'uses the object as context when executing the fallback')
          assert.strictEqual(_.result(obj, ['a', 'x'], context), obj, 'uses the object as context when executing the fallback')
          assert.strictEqual(_.result(obj, ['b', 'c']), childObj, 'uses the parent as context when accessing deep methods')

          assert.strictEqual(_.result({}, [], 'a'), 'a', 'returns the default when prop is empty')
          assert.strictEqual(_.result(obj, [], context), obj, 'uses the object as context when path is empty')

          var nested = {
            d: function() {
              return {
                e: function() {
                  return obj
                },
                f: context
              }
            }
          }
          assert.strictEqual(_.result(nested, ['d', 'e']), obj, 'can unpack nested function calls')
          assert.strictEqual(_.result(nested, ['d', 'f']).e(), obj, 'uses parent as context for nested function calls')
          assert.strictEqual(_.result(nested, ['d', 'x'], context).e(), obj, 'uses last valid child as context for fallback')

          if (typeof Symbol !== 'undefined') {
            var x = Symbol('x')
            var symbolObject = {}
            symbolObject[x] = 'foo'
            assert.strictEqual(_.result(symbolObject, x), 'foo', 'can use symbols as keys')

            var y = Symbol('y')
            symbolObject[y] = {}
            symbolObject[y][x] = 'bar'
            assert.strictEqual(_.result(symbolObject, [y, x]), 'bar', 'can use symbols as keys for deep matching')
          }
        })

        QUnit.test('_.templateSettings.variable', function(assert) {
          var s = '<%=data.x%>'
          var data = {x: 'x'}
          var tmp = _.template(s, {variable: 'data'})
          assert.strictEqual(tmp(data), 'x')
          _.templateSettings.variable = 'data'
          assert.strictEqual(_.template(s)(data), 'x')
        })

        QUnit.test('#547 - _.templateSettings is unchanged by custom settings.', function(assert) {
          assert.notOk(_.templateSettings.variable)
          _.template('', {}, {variable: 'x'})
          assert.notOk(_.templateSettings.variable)
        })

        QUnit.test('#556 - undefined template variables.', function(assert) {
          var template = _.template('<%=x%>')
          assert.strictEqual(template({x: null}), '')
          assert.strictEqual(template({x: void 0}), '')

          var templateEscaped = _.template('<%-x%>')
          assert.strictEqual(templateEscaped({x: null}), '')
          assert.strictEqual(templateEscaped({x: void 0}), '')

          var templateWithProperty = _.template('<%=x.foo%>')
          assert.strictEqual(templateWithProperty({x: {}}), '')
          assert.strictEqual(templateWithProperty({x: {}}), '')

          var templateWithPropertyEscaped = _.template('<%-x.foo%>')
          assert.strictEqual(templateWithPropertyEscaped({x: {}}), '')
          assert.strictEqual(templateWithPropertyEscaped({x: {}}), '')
        })

        QUnit.test('interpolate evaluates code only once.', function(assert) {
          assert.expect(2)
          var count = 0
          var template = _.template('<%= f() %>')
          template({f: function() { assert.notOk(count++) }})

          var countEscaped = 0
          var templateEscaped = _.template('<%- f() %>')
          templateEscaped({f: function() { assert.notOk(countEscaped++) }})
        })

        QUnit.test('#746 - _.template settings are not modified.', function(assert) {
          assert.expect(1)
          var settings = {}
          _.template('', null, settings)
          assert.deepEqual(settings, {})
        })

        QUnit.test('#779 - delimiters are applied to unescaped text.', function(assert) {
          assert.expect(1)
          var template = _.template('<<\nx\n>>', null, {evaluate: /<<(.*?)>>/g})
          assert.strictEqual(template(), '<<\nx\n>>')
        })

      }
    }))

  })

})
