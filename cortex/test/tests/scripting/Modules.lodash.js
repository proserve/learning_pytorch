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

  describe('Lodash', function() {

    it('Arrays', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('lodash')

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

        QUnit.test('head', function(assert) {
          assert.strictEqual(_.head, _.first, 'is an alias for first')
        })

        QUnit.test('take', function(assert) {
          var numbers = [1, 2, 3, 4]
          assert.deepEqual(_.take(numbers), [1], 'fetches first element')
          assert.deepEqual(_.take(numbers, 0), [], 'returns empty array when index is 0')
          assert.deepEqual(_.take(numbers, 2), [1, 2], 'returns 2 elements starting at beginning')
          var result = (function() { return _(arguments).take() }(1, 2, 3, 4)).value()
          assert.deepEqual(result, [1], 'works on an arguments object')
          result = _.map([[1, 2, 3], [1, 2, 3]], _.take)
          assert.deepEqual(_.flatten(result), [1, 1], 'works well with _.map')
        })

        QUnit.test('initial', function(assert) {
          assert.deepEqual(_.initial([1, 2, 3, 4, 5]), [1, 2, 3, 4], 'returns all but the last element')
          var result = (function() { return _(arguments).initial() }(1, 2, 3, 4)).value()
          assert.deepEqual(result, [1, 2, 3], 'works on an arguments object')
          result = _.map([[1, 2, 3], [1, 2, 3]], _.initial)
          assert.deepEqual(_.flatten(result), [1, 2, 1, 2], 'works well with _.map')
        })

        QUnit.test('last', function(assert) {
          assert.strictEqual(_.last([1, 2, 3]), 3, 'can pull out the last element of an array')
          assert.strictEqual(_([1, 2, 3]).last(), 3, 'can perform OO-style "last()"')
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

        QUnit.test('flatten/flattenDeep', function(assert) {
          assert.deepEqual(_.flatten(null), [], 'supports null')
          assert.deepEqual(_.flatten(void 0), [], 'supports undefined')

          assert.deepEqual(_.flatten([[], [[]], []]), [[]], 'supports empty arrays')
          assert.deepEqual(_.flatten([[], [[]], []], true), [[]], 'can shallowly flatten empty arrays')

          var list = [1, [2], [3, [[[4]]]]]
          assert.deepEqual(_.flattenDeep(list), [1, 2, 3, 4], 'can flatten nested arrays')
          assert.deepEqual(_.flatten(list), [1, 2, 3, [[[4]]]], 'can shallowly flatten nested arrays')
          var result = (function() { return _.flattenDeep(arguments) }(1, [2], [3, [[[4]]]]))
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

        QUnit.test('sortedIndex/sortedIndexBy', function(assert) {
          var numbers = [10, 20, 30, 40, 50]
          var indexFor35 = _.sortedIndex(numbers, 35)
          assert.strictEqual(indexFor35, 3, 'finds the index at which a value should be inserted to retain order')
          var indexFor30 = _.sortedIndex(numbers, 30)
          assert.strictEqual(indexFor30, 2, 'finds the smallest index at which a value could be inserted to retain order')

          var objects = [{x: 10}, {x: 20}, {x: 30}, {x: 40}]
          var iterator = function(obj) { return obj.x }
          assert.strictEqual(_.sortedIndexBy(objects, {x: 25}, iterator), 2, 'uses the result of `iterator` for order comparisons')
          assert.strictEqual(_.sortedIndexBy(objects, {x: 35}, 'x'), 3, 'when `iterator` is a string, uses that key for order comparisons')

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

        QUnit.test('uniq/uniqBy', function(assert) {
          var list = [1, 2, 1, 3, 1, 4]
          assert.deepEqual(_.uniq(list), [1, 2, 3, 4], 'can find the unique values of an unsorted array')
          list = [1, 1, 1, 2, 2, 3]
          assert.deepEqual(_.uniq(list, true), [1, 2, 3], 'can find the unique values of a sorted array faster')

          list = [{name: 'Moe'}, {name: 'Curly'}, {name: 'Larry'}, {name: 'Curly'}]
          var expected = [{name: 'Moe'}, {name: 'Curly'}, {name: 'Larry'}]
          var iterator = function(stooge) { return stooge.name }
          assert.deepEqual(_.uniqBy(list, iterator), expected, '`sorted` argument defaults to false when omitted')
          assert.deepEqual(_.uniqBy(list, 'name'), expected, 'when `iterator` is a string, uses that key for comparisons (unsorted case)')

          list = [{score: 8}, {score: 10}, {score: 10}]
          expected = [{score: 8}, {score: 10}]
          iterator = function(item) { return item.score }
          assert.deepEqual(_.uniqBy(list, iterator), expected, 'uses the result of `iterator` for uniqueness comparisons (sorted case)')
          assert.deepEqual(_.uniqBy(list, 'score'), expected, 'when `iterator` is a string, uses that key for comparisons (sorted case)')

          assert.deepEqual(_.uniqBy([{0: 1}, {0: 1}, {0: 1}, {0: 2}], 0), [{0: 1}, {0: 2}], 'can use falsy pluck like iterator')

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

        QUnit.test('intersection', function(assert) {
          var stooges = ['moe', 'curly', 'larry'], leaders = ['moe', 'groucho']
          assert.deepEqual(_.intersection(stooges, leaders), ['moe'], 'can find the set intersection of two arrays')
          assert.deepEqual(_(stooges).intersection(leaders).value(), ['moe'], 'can perform an OO-style intersection')
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

          result = _([1, 2, 3]).union([2, 30, 1], [1, 40]).value()
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

          result = _([1, 2, 3]).difference([2, 30, 40]).value()
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
          var index = _.indexOf(numbers, num)
          assert.strictEqual(index, -1, '35 is not in the list')

          numbers = [10, 20, 30, 40, 50]; num = 40
          index = _.indexOf(numbers, num, true)
          assert.strictEqual(index, 3, '40 is in the list')

          numbers = [1, 40, 40, 40, 40, 40, 40, 40, 50, 60, 70]; num = 40
          assert.strictEqual(_.indexOf(numbers, num), 1, '40 is in the list')
          assert.strictEqual(_.indexOf(numbers, 6), -1, '6 isnt in the list')
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
            assert.strictEqual(_.indexOf(array, 1, fromIndex), 0, 'error')
          })
          assert.strictEqual(_.indexOf([1, 2, 3], 1), 0, 'error')

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
            assert.strictEqual(_.lastIndexOf(array, void 0, fromIndex), -1, 'error')
            assert.strictEqual(_.lastIndexOf(array, 1, fromIndex), 3, 'error')
            assert.strictEqual(_.lastIndexOf(array, '', fromIndex), -1, 'error')
          })

          assert.strictEqual(_.lastIndexOf(array, 2, -3), 1, 'should work with a negative `fromIndex`')
          assert.strictEqual(_.lastIndexOf(array, 1, -3), 3, 'neg `fromIndex` starts at the right index')

          assert.deepEqual(_.map([-6, -8, -Infinity], function(fromIndex) {
            return _.lastIndexOf(array, 1, fromIndex)
          }), [0, 0, 0], 'error')
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
          assert.deepEqual(_.chunk([1, 2, 3]), [[1], [2], [3]], 'defaults to parts of 1 elements returns original array (chunk size 1)')

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
      var _ = require('lodash')

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
      var _ = require('lodash')

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
          _.each([1, 2, 3], function(num, index, arr) { if (_.includes(arr, num)) answer = true })
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

        QUnit.test('map', function(assert) {
          var doubled = _.map([1, 2, 3], function(num) { return num * 2 })
          assert.deepEqual(doubled, [2, 4, 6], 'doubled numbers')

          doubled = _([1, 2, 3]).map(function(num) { return num * 2 }).value()
          assert.deepEqual(doubled, [2, 4, 6], 'OO-style doubled numbers')

          var ids = _.map({length: 2, 0: {id: '1'}, 1: {id: '2'}}, function(n) {
            return n.id
          })
          assert.deepEqual(ids, ['1', '2'], 'Can use collection methods on Array-likes.')

          assert.deepEqual(_.map(null, _.noop), [], 'handles a null properly')

          // Passing a property name like _.pluck.
          var people = [{name: 'moe', age: 30}, {name: 'curly', age: 50}]
          assert.deepEqual(_.map(people, 'name'), ['moe', 'curly'], 'predicate string map to object properties')
        })

        QUnit.test('reduce', function(assert) {
          var sum = _.reduce([1, 2, 3], function(memo, num) { return memo + num }, 0)
          assert.strictEqual(sum, 6, 'can sum up an array')

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
        })

        QUnit.test('filter', function(assert) {
          var evenArray = [1, 2, 3, 4, 5, 6]
          var evenObject = {one: 1, two: 2, three: 3}
          var isEven = function(num) { return num % 2 === 0 }

          assert.deepEqual(_.filter(evenArray, isEven), [2, 4, 6])
          assert.deepEqual(_.filter(evenObject, isEven), [2], 'can filter objects')
          assert.deepEqual(_.filter([{}, evenObject, []], 'two'), [evenObject], 'predicate string map to object properties')

          // Can be used like _.where.
          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}]
          assert.deepEqual(_.filter(list, {a: 1}), [{a: 1, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}])
          assert.deepEqual(_.filter(list, {b: 2}), [{a: 1, b: 2}, {a: 2, b: 2}])
          assert.deepEqual(_.filter(list, {}), list, 'Empty object accepts all items')
          assert.deepEqual(_(list).filter({}).value(), list, 'OO-filter')
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
        })

        QUnit.test('includes', function(assert) {
          _.each([null, void 0, 0, 1, NaN, {}, []], function(val) {
            assert.strictEqual(_.includes(val, 'hasOwnProperty'), false)
          })
          assert.strictEqual(_.includes([1, 2, 3], 2), true, 'two is in the array')
          assert.notOk(_.includes([1, 3, 9], 2), 'two is not in the array')

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

        QUnit.test('invokeMap', function(assert) {
          var list = [[5, 1, 7], [3, 2, 1]]
          var result = _.invokeMap(list, 'sort')
          assert.deepEqual(result[0], [1, 5, 7], 'first array sorted')
          assert.deepEqual(result[1], [1, 2, 3], 'second array sorted')

          _.invokeMap([{
            method: function() {
              assert.deepEqual(_.toArray(arguments), [1, 2, 3], 'called with arguments')
            }
          }], 'method', 1, 2, 3)

          assert.deepEqual(_.invokeMap([{a: null}, {}, {a: _.constant(1)}], 'a'), [void 0, void 0, 1], 'handles null & undefined')

          assert.raises(function() {
            _.invokeMap([{a: 1}], 'a')
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
          assert.deepEqual(_.invokeMap(arr, ['a', 'b']), ['foo'], 'supports deep method access via an array syntax')
          assert.deepEqual(_.invokeMap(arr, ['a', 'c']), [item.a], 'executes deep methods on their direct parent')
          assert.deepEqual(_.invokeMap(arr, ['a', 'd', 'z']), [void 0], 'does not try to access attributes of non-objects')
          assert.deepEqual(_.invokeMap(arr, ['a', 'd']), [void 0], 'handles deep null values')
          assert.deepEqual(_.invokeMap(arr, ['e']), ['foo'], 'handles path arrays of length one')
          assert.deepEqual(_.invokeMap(arr, ['f']), [item], 'correct uses parent context with shallow array syntax')
          assert.deepEqual(_.invokeMap(arr, ['g', 'h']), [void 0], 'does not execute intermediate functions')

          arr = [{
            a: function() { return 'foo' }
          }, {
            a: function() { return 'bar' }
          }]
          assert.deepEqual(_.invokeMap(arr, 'a'), ['foo', 'bar'], 'can handle different methods on subsequent objects')
        })

        QUnit.test('invokeMap w/ function reference', function(assert) {
          var list = [[5, 1, 7], [3, 2, 1]]
          var result = _.invokeMap(list, Array.prototype.sort)
          assert.deepEqual(result[0], [1, 5, 7], 'first array sorted')
          assert.deepEqual(result[1], [1, 2, 3], 'second array sorted')

          assert.deepEqual(_.invokeMap([1, 2, 3], function(a) {
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
          var result = _.invokeMap(list, 'sort')
          assert.deepEqual(result[0], [1, 5, 7], 'first array sorted')
          assert.deepEqual(result[1], [1, 2, 3], 'second array sorted')
          delete String.prototype.call
          assert.strictEqual(s.call, void 0, 'call function removed')
        })

        QUnit.test('find', function(assert) {
          var list = [{a: 1, b: 2}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 1, b: 4}, {a: 2, b: 4}]
          var result = _.find(list, {a: 1})
          assert.deepEqual(result, {a: 1, b: 2})
          result = _.find(list, {b: 4})
          assert.deepEqual(result, {a: 1, b: 4})

          result = _.find(list, {c: 1})
          assert.ok(_.isUndefined(result), 'undefined when not found')

          result = _.find([], {c: 1})
          assert.ok(_.isUndefined(result), 'undefined when searching empty list')

          function TestClass() {
            this.y = 5
            this.x = 'foo'
          }
          var expect = {c: 1, x: 'foo', y: 5}
          assert.deepEqual(_.find([{y: 5, b: 6}, expect], new TestClass()), expect, 'uses class instance properties')
        })

        QUnit.test('max', function(assert) {
          assert.strictEqual(_.max([1, 2, 3]), 3, 'can perform a regular Math.max')

          var neg = _.maxBy([1, 2, 3], function(num) { return -num })
          assert.strictEqual(neg, 1, 'can perform a computation-based max')

          assert.strictEqual(void 0, _.max({}), 'Maximum value of an empty object')
          assert.strictEqual(void 0, _.max([]), 'Maximum value of an empty array')
          assert.strictEqual(_.max({a: 'a'}), void 0, 'Maximum value of a non-numeric collection')

          assert.strictEqual(_.max(_.range(1, 3000)), 2999, 'Maximum value of a big array')

          assert.strictEqual(_.max([1, 2, 3, 'test']), 3, 'Finds correct max in array starting with num and containing a NaN')

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
          assert.strictEqual(_.maxBy([a, b], iterator), a, 'Respects iterator return value of -Infinity')

          assert.deepEqual(_.maxBy([{a: 1}, {a: 0, b: 3}, {a: 4}, {a: 2}], 'a'), {a: 4}, 'String keys use property iterator')

          assert.deepEqual(_.maxBy([[1], [2, 3], [-1, 4], [5]], 0), [5], 'Lookup falsy iterator')
          assert.deepEqual(_.maxBy([{0: 1}, {0: 2}, {0: -1}, {a: 1}], 0), {0: 2}, 'Lookup falsy iterator')
        })

        QUnit.test('min', function(assert) {
          assert.strictEqual(_.min(null), void 0, 'can handle null/undefined')
          assert.strictEqual(_.min(void 0), void 0, 'can handle null/undefined')
          assert.strictEqual(_.min(null, _.identity), void 0, 'can handle null/undefined')

          assert.strictEqual(_.min([1, 2, 3]), 1, 'can perform a regular Math.min')

          var neg = _.minBy([1, 2, 3], function(num) { return -num })
          assert.strictEqual(neg, 3, 'can perform a computation-based min')

          assert.strictEqual(_.min({}), void 0, 'Minimum value of an empty object')
          assert.strictEqual(_.min([]), void 0, 'Minimum value of an empty array')
          assert.strictEqual(_.min({a: 'a'}), void 0, 'Minimum value of a non-numeric collection')

          assert.deepEqual(_.map([[1, 2, 3], [4, 5, 6]], _.min), [1, 4], 'Finds correct min in array when mapping through multiple arrays')

          var now = new Date(9999999999)
          var then = new Date(0)
          assert.strictEqual(_.minBy([now, then]), then)

          assert.strictEqual(_.min(_.range(1, 3000)), 1, 'Minimum value of a big array')

          assert.strictEqual(_.min([1, 2, 3, 'test']), 1, 'Finds correct min in array starting with num and containing a NaN')

          assert.strictEqual(_.min([1, 2, 3, null]), 1, 'Finds correct min in array starting with num and containing a `null`')
          assert.strictEqual(_.min([null, 1, 2, 3]), 1, 'Finds correct min in array starting with a `null`')

          assert.strictEqual(_.min([0, 1, 2, 3, 4]), 0, 'Finds correct min in array containing a zero')
          assert.strictEqual(_.min([-3, -2, -1, 0]), -3, 'Finds correct min in array containing negative numbers')

          var a = {x: Infinity}
          var b = {x: Infinity}
          var iterator = function(o) { return o.x }
          assert.strictEqual(_.minBy([a, b], iterator), a, 'Respects iterator return value of Infinity')

          assert.deepEqual(_.minBy([{a: 1}, {a: 0, b: 3}, {a: 4}, {a: 2}], 'a'), {a: 0, b: 3}, 'String keys use property iterator')

          assert.deepEqual(_.minBy([[1], [2, 3], [-1, 4], [5]], 0), [-1, 4], 'Lookup falsy iterator')
          assert.deepEqual(_.minBy([{0: 1}, {0: 2}, {0: -1}, {a: 1}], 0), {0: -1}, 'Lookup falsy iterator')
        })

        QUnit.test('sortBy', function(assert) {
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

          var stableObject = _.zipObject('abcdefghijklmnopqr'.split(''), stableArray)

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

          grouped = _.groupBy([4.2, 6.1, 6.4], function(num) {
            return Math.floor(num) > 4 ? 'hasOwnProperty' : 'constructor'
          })
          assert.strictEqual(grouped.constructor.length, 1)
          assert.strictEqual(grouped.hasOwnProperty.length, 2)

          var array = [1, 2, 1, 2, 3]
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
          assert.deepEqual(_.groupBy(collection, 'stats.power'), expected, 'can group by deep properties')
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

          grouped = _.countBy([4.2, 6.1, 6.4], function(num) {
            return Math.floor(num) > 4 ? 'hasOwnProperty' : 'constructor'
          })
          assert.strictEqual(grouped.constructor, 1)
          assert.strictEqual(grouped.hasOwnProperty, 2)

          var array = [1, 2, 1, 2, 3]
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

        QUnit.test('sampleSize', function(assert) {
          assert.strictEqual(_.sample([1]), 1, 'behaves correctly when no second parameter is given')
          assert.deepEqual(_.sampleSize([1, 2, 3], -2), [], 'behaves correctly on negative n')
          var numbers = _.range(10)
          var allSampled = _.sampleSize(numbers, 10).sort()
          assert.deepEqual(allSampled, numbers, 'contains the same members before and after sample')
          allSampled = _.sampleSize(numbers, 20).sort()
          assert.deepEqual(allSampled, numbers, 'also works when sampling more objects than are present')
          assert.ok(_.includes(numbers, _.sample(numbers)), 'sampling a single element returns something from the array')
          assert.strictEqual(_.sample([]), void 0, 'sampling empty array with no number returns undefined')
          assert.notStrictEqual(_.sampleSize([], 5), [], 'sampling empty array with a number returns an empty array')
          assert.notStrictEqual(_.sampleSize([1, 2, 3], 0), [], 'sampling an array with 0 picks returns an empty array')
          assert.deepEqual(_.sampleSize([1, 2], -1), [], 'sampling a negative number of picks returns an empty array')
          assert.ok(_.includes([1, 2, 3], _.sample({a: 1, b: 2, c: 3})), 'sample one value from an object')
          var partialSample = _.sampleSize(_.range(100), 10)
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

          // Default iterator
          assert.deepEqual(_.partition([1, false, true, '']), [[1, true], [false, '']], 'Default iterator')
          assert.deepEqual(_.partition([{x: 1}, {x: 0}, {x: 1}], 'x'), [[{x: 1}, {x: 1}], [{x: 0}]], 'Takes a string')

          assert.deepEqual(_.partition([{a: 1}, {b: 2}, {a: 1, b: 2}], {a: 1}), [[{a: 1}, {a: 1, b: 2}], [{b: 2}]], 'predicate can be object')
        })

      }
    }))

    it('Functions', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('lodash')

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
          _.bindAll(moe, ['getName', 'sayHi'])
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

          assert.raises(function() { _.bindAll(moe, 'sayBye') }, TypeError, 'throws an error for bindAll if the given key is undefined')
          assert.raises(function() { _.bindAll(moe, 'name') }, TypeError, 'throws an error for bindAll if the given key is not a function')

          _.bindAll(moe, ['sayHi', 'sayLast'])
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
          assert.strictEqual(upper('foo'), 'FOO', 'error')
          assert.strictEqual(upper('bar'), 'BAR', 'error')
          assert.strictEqual(upper.cache.get('foo'), 'FOO')
          assert.strictEqual(upper.cache.get('bar'), 'BAR')
          upper.cache.set('foo', 'BAR')
          upper.cache.set('bar', 'FOO')
          assert.strictEqual(upper('foo'), 'BAR', 'error')
          assert.strictEqual(upper('bar'), 'FOO', 'error')

          var hashed = _.memoize(function(key) {
            // https://github.com/jashkenas/underscore/pull/1679#discussion_r13736209
            assert.ok(/[a-z]+/.test(key), 'hasher doesn\'t change keys')
            return key
          }, function(key) {
            return key.toUpperCase()
          })
          hashed('yep')
          assert.strictEqual(hashed.cache.get('YEP'), 'yep', 'takes a hasher')

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
          assert.deepEqual(_.countBy(collection, /b/g), {0: 1, 1: 1, 2: 1}, 'error countBy')
          assert.strictEqual(_.every(collection, /b/g), false, 'error every')
          assert.deepEqual(_.filter(collection, /b/g), ['bar', 'bbiz'], 'error filter')
          assert.strictEqual(_.find(collection, /b/g), 'bar', 'error find')
          assert.strictEqual(_.findIndex(collection, /b/g), 1, 'error findIndex')
          assert.strictEqual(_.findKey(collection, /b/g), '1', 'error findKey')
          assert.strictEqual(_.findLastIndex(collection, /b/g), 2, 'error findLastIndex')
          assert.deepEqual(_.groupBy(collection, /b/g), {0: ['foo'], 1: ['bar'], 2: ['bbiz']}, 'error groupBy')
          assert.deepEqual(_.map(collection, /b/g), [0, 1, 2], 'error map')
          assert.strictEqual(_.max(collection, /b/g), 'foo', 'error max')
          assert.strictEqual(_.min(collection, /b/g), 'bar', 'error min')
          assert.deepEqual(_.partition(collection, /b/g), [['bar', 'bbiz'], ['foo']], 'error partition')
          assert.deepEqual(_.reject(collection, /b/g), ['foo'], 'error reject')
          assert.strictEqual(_.some(collection, /b/g), true, 'error some')
          assert.deepEqual(_.sortBy(collection, /b/g), ['foo', 'bar', 'bbiz'], 'error sortBy')
          assert.strictEqual(_.sortedIndex(collection, 'blah', /b/g), 3, 'error sortedIndexBy')
          assert.deepEqual(_.uniqBy(collection, /b/g), ['foo', 'bar', 'bbiz'], 'error uniq')
          // Restore the builtin iteratee
          _.iteratee = builtinIteratee
        })
      }
    }))

    it('Objects', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('lodash')

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

        QUnit.test('isDate', function(assert) {
          assert.notOk(_.isDate(100), 'numbers are not dates')
          assert.notOk(_.isDate({}), 'objects are not dates')
          assert.ok(_.isDate(new Date()), 'but dates are')
        })

        QUnit.test('isRegExp', function(assert) {
          assert.notOk(_.isRegExp(_.identity), 'functions are not RegExps')
          assert.ok(_.isRegExp(/identity/), 'but RegExps are')
        })

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

          var array = [1, 2, 3, 4]
          array.match = 55
          assert.strictEqual(_.findKey(array, function(x) { return x === 55 }), 'match', 'matches array-likes keys')
        })

        QUnit.test('mapValues', function(assert) {
          var obj = {a: 1, b: 2}
          var objects = {
            a: {a: 0, b: 0},
            b: {a: 1, b: 1},
            c: {a: 2, b: 2}
          }

          assert.deepEqual(_.mapValues(obj, function(val) {
            return val * 2
          }), {a: 2, b: 4}, 'simple objects')

          assert.deepEqual(_.mapValues(objects, function(val) {
            return _.reduce(val, function(memo, v) {
              return memo + v
            }, 0)
          }), {a: 0, b: 2, c: 4}, 'nested objects')

          assert.deepEqual(_.mapValues(obj, function(val, key, o) {
            return o[key] * 2
          }), {a: 2, b: 4}, 'correct keys')

          assert.deepEqual(_.mapValues([1, 2], function(val) {
            return val * 2
          }), {0: 2, 1: 4}, 'check behavior for arrays')

          var ids = _.mapValues({length: 2, 0: {id: '1'}, 1: {id: '2'}}, function(n) {
            return n.id
          })
          assert.deepEqual(ids, {length: void 0, 0: '1', 1: '2'}, 'Check with array-like objects')

          // Passing a property name like _.pluck.
          var people = {a: {name: 'moe', age: 30}, b: {name: 'curly', age: 50}}
          assert.deepEqual(_.mapValues(people, 'name'), {a: 'moe', b: 'curly'}, 'predicate string map to object properties')

          _.each([null, void 0, 1, [], {}, void 0], function(val) {
            assert.deepEqual(_.mapValues(val, _.identity), {}, 'mapValue identity')
          })

          var Proto = function() { this.a = 1 }
          Proto.prototype.b = 1
          var protoObj = new Proto()
          assert.deepEqual(_.mapValues(protoObj, _.identity), {a: 1}, 'ignore inherited values from prototypes')

        })

      }
    }))

    it('Utility', sandboxed(function() {

      var global = Function('return this')()
      global.global = global

      var QUnit = require('qunit')
      var _ = require('lodash')

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
          assert.strictEqual(_('champ').myReverse().value(), 'pmahc', 'mixed in a function to the OOP wrapper')
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
          var escapeCharacters = ['<', '>', '"', '\'']

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
