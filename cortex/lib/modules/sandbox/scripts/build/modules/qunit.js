/*!
 * QUnit 2.4.0
 * https://qunitjs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2017-07-08T15:20Z
 */
(function(global$1) {
  'use strict'

  global$1 = global$1 && 'default' in global$1 ? global$1['default'] : global$1

  var _typeof = function(obj) {
    return typeof obj
  }

  var classCallCheck = function(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError('Cannot call a class as a function')
    }
  }

  var createClass = (function() {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i]
        descriptor.enumerable = descriptor.enumerable || false
        descriptor.configurable = true
        if ('value' in descriptor) descriptor.writable = true
        Object.defineProperty(target, descriptor.key, descriptor)
      }
    }

    return function(Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps)
      if (staticProps) defineProperties(Constructor, staticProps)
      return Constructor
    }
  }())

  var toConsumableArray = function(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]

      return arr2
    } else {
      return Array.from(arr)
    }
  }

  var toString = Object.prototype.toString
  var hasOwn = Object.prototype.hasOwnProperty
  var now = Date.now || function() {
    return new Date().getTime()
  }

  // Returns a new Array with the elements that are in a but not in b
  function diff(a, b) {
    var i,
        j,
        result = a.slice()

    for (i = 0; i < result.length; i++) {
      for (j = 0; j < b.length; j++) {
        if (result[i] === b[j]) {
          result.splice(i, 1)
          i--
          break
        }
      }
    }
    return result
  }

  /**
     * Determines whether an element exists in a given array or not.
     *
     * @method inArray
     * @param {Any} elem
     * @param {Array} array
     * @return {Boolean}
     */
  function inArray(elem, array) {
    return array.indexOf(elem) !== -1
  }

  /**
     * Makes a clone of an object using only Array or Object as base,
     * and copies over the own enumerable properties.
     *
     * @param {Object} obj
     * @return {Object} New object with only the own properties (recursively).
     */
  function objectValues(obj) {
    var key,
        val,
        vals = is('array', obj) ? [] : {}
    for (key in obj) {
      if (hasOwn.call(obj, key)) {
        val = obj[key]
        vals[key] = val === Object(val) ? objectValues(val) : val
      }
    }
    return vals
  }

  function extend(a, b, undefOnly) {
    for (var prop in b) {
      if (hasOwn.call(b, prop)) {
        if (b[prop] === undefined) {
          delete a[prop]
        } else if (!(undefOnly && typeof a[prop] !== 'undefined')) {
          a[prop] = b[prop]
        }
      }
    }

    return a
  }

  function objectType(obj) {
    if (typeof obj === 'undefined') {
      return 'undefined'
    }

    // Consider: typeof null === object
    if (obj === null) {
      return 'null'
    }

    var match = toString.call(obj).match(/^\[object\s(.*)\]$/),
        type = match && match[1]

    switch (type) {
      case 'Number':
        if (isNaN(obj)) {
          return 'nan'
        }
        return 'number'
      case 'String':
      case 'Boolean':
      case 'Array':
      case 'Set':
      case 'Map':
      case 'Date':
      case 'RegExp':
      case 'Function':
      case 'Symbol':
        return type.toLowerCase()
      default:
        return typeof obj === 'undefined' ? 'undefined' : _typeof(obj)
    }
  }

  // Safe object type checking
  function is(type, obj) {
    return objectType(obj) === type
  }

  // Based on Java's String.hashCode, a simple but not
  // rigorously collision resistant hashing function
  function generateHash(module, testName) {
    var str = module + '\x1C' + testName
    var hash = 0

    for (var i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }

    // Convert the possibly negative integer hash code into an 8 character hex string, which isn't
    // strictly necessary but increases user understanding that the id is a SHA-like hash
    var hex = (0x100000000 + hash).toString(16)
    if (hex.length < 8) {
      hex = '0000000' + hex
    }

    return hex.slice(-8)
  }

  // Test for equality any JavaScript type.
  // Authors: Philippe Rathé <prathe@gmail.com>, David Chan <david@troi.org>
  var equiv = (function() {

    // Value pairs queued for comparison. Used for breadth-first processing order, recursion
    // detection and avoiding repeated comparison (see below for details).
    // Elements are { a: val, b: val }.
    var pairs = []

    var getProto = Object.getPrototypeOf || function(obj) {
      return obj.__proto__
    }

    function useStrictEquality(a, b) {

      // This only gets called if a and b are not strict equal, and is used to compare on
      // the primitive values inside object wrappers. For example:
      // `var i = 1;`
      // `var j = new Number(1);`
      // Neither a nor b can be null, as a !== b and they have the same type.
      if ((typeof a === 'undefined' ? 'undefined' : _typeof(a)) === 'object') {
        a = a.valueOf()
      }
      if ((typeof b === 'undefined' ? 'undefined' : _typeof(b)) === 'object') {
        b = b.valueOf()
      }

      return a === b
    }

    function compareConstructors(a, b) {
      var protoA = getProto(a)
      var protoB = getProto(b)

      // Comparing constructors is more strict than using `instanceof`
      if (a.constructor === b.constructor) {
        return true
      }

      // Ref #851
      // If the obj prototype descends from a null constructor, treat it
      // as a null prototype.
      if (protoA && protoA.constructor === null) {
        protoA = null
      }
      if (protoB && protoB.constructor === null) {
        protoB = null
      }

      // Allow objects with no prototype to be equivalent to
      // objects with Object as their constructor.
      if (protoA === null && protoB === Object.prototype || protoB === null && protoA === Object.prototype) {
        return true
      }

      return false
    }

    function getRegExpFlags(regexp) {
      return 'flags' in regexp ? regexp.flags : regexp.toString().match(/[gimuy]*$/)[0]
    }

    function isContainer(val) {
      return ['object', 'array', 'map', 'set'].indexOf(objectType(val)) !== -1
    }

    function breadthFirstCompareChild(a, b) {

      // If a is a container not reference-equal to b, postpone the comparison to the
      // end of the pairs queue -- unless (a, b) has been seen before, in which case skip
      // over the pair.
      if (a === b) {
        return true
      }
      if (!isContainer(a)) {
        return typeEquiv(a, b)
      }
      if (pairs.every(function(pair) {
        return pair.a !== a || pair.b !== b
      })) {

        // Not yet started comparing this pair
        pairs.push({ a: a, b: b })
      }
      return true
    }

    var callbacks = {
      'string': useStrictEquality,
      'boolean': useStrictEquality,
      'number': useStrictEquality,
      'null': useStrictEquality,
      'undefined': useStrictEquality,
      'symbol': useStrictEquality,
      'date': useStrictEquality,

      'nan': function nan() {
        return true
      },

      'regexp': function regexp(a, b) {
        return a.source === b.source &&

                    // Include flags in the comparison
                    getRegExpFlags(a) === getRegExpFlags(b)
      },

      // abort (identical references / instance methods were skipped earlier)
      'function': function _function() {
        return false
      },

      'array': function array(a, b) {
        var i, len

        len = a.length
        if (len !== b.length) {

          // Safe and faster
          return false
        }

        for (i = 0; i < len; i++) {

          // Compare non-containers; queue non-reference-equal containers
          if (!breadthFirstCompareChild(a[i], b[i])) {
            return false
          }
        }
        return true
      },

      // Define sets a and b to be equivalent if for each element aVal in a, there
      // is some element bVal in b such that aVal and bVal are equivalent. Element
      // repetitions are not counted, so these are equivalent:
      // a = new Set( [ {}, [], [] ] );
      // b = new Set( [ {}, {}, [] ] );
      'set': function set$$1(a, b) {
        var innerEq,
            outerEq = true

        if (a.size !== b.size) {

          // This optimization has certain quirks because of the lack of
          // repetition counting. For instance, adding the same
          // (reference-identical) element to two equivalent sets can
          // make them non-equivalent.
          return false
        }

        a.forEach(function(aVal) {

          // Short-circuit if the result is already known. (Using for...of
          // with a break clause would be cleaner here, but it would cause
          // a syntax error on older Javascript implementations even if
          // Set is unused)
          if (!outerEq) {
            return
          }

          innerEq = false

          b.forEach(function(bVal) {
            var parentPairs

            // Likewise, short-circuit if the result is already known
            if (innerEq) {
              return
            }

            // Swap out the global pairs list, as the nested call to
            // innerEquiv will clobber its contents
            parentPairs = pairs
            if (innerEquiv(bVal, aVal)) {
              innerEq = true
            }

            // Replace the global pairs list
            pairs = parentPairs
          })

          if (!innerEq) {
            outerEq = false
          }
        })

        return outerEq
      },

      // Define maps a and b to be equivalent if for each key-value pair (aKey, aVal)
      // in a, there is some key-value pair (bKey, bVal) in b such that
      // [ aKey, aVal ] and [ bKey, bVal ] are equivalent. Key repetitions are not
      // counted, so these are equivalent:
      // a = new Map( [ [ {}, 1 ], [ {}, 1 ], [ [], 1 ] ] );
      // b = new Map( [ [ {}, 1 ], [ [], 1 ], [ [], 1 ] ] );
      'map': function map(a, b) {
        var innerEq,
            outerEq = true

        if (a.size !== b.size) {

          // This optimization has certain quirks because of the lack of
          // repetition counting. For instance, adding the same
          // (reference-identical) key-value pair to two equivalent maps
          // can make them non-equivalent.
          return false
        }

        a.forEach(function(aVal, aKey) {

          // Short-circuit if the result is already known. (Using for...of
          // with a break clause would be cleaner here, but it would cause
          // a syntax error on older Javascript implementations even if
          // Map is unused)
          if (!outerEq) {
            return
          }

          innerEq = false

          b.forEach(function(bVal, bKey) {
            var parentPairs

            // Likewise, short-circuit if the result is already known
            if (innerEq) {
              return
            }

            // Swap out the global pairs list, as the nested call to
            // innerEquiv will clobber its contents
            parentPairs = pairs
            if (innerEquiv([bVal, bKey], [aVal, aKey])) {
              innerEq = true
            }

            // Replace the global pairs list
            pairs = parentPairs
          })

          if (!innerEq) {
            outerEq = false
          }
        })

        return outerEq
      },

      'object': function object(a, b) {
        var i,
            aProperties = [],
            bProperties = []

        if (compareConstructors(a, b) === false) {
          return false
        }

        // Be strict: don't ensure hasOwnProperty and go deep
        for (i in a) {

          // Collect a's properties
          aProperties.push(i)

          // Skip OOP methods that look the same
          if (a.constructor !== Object && typeof a.constructor !== 'undefined' && typeof a[i] === 'function' && typeof b[i] === 'function' && a[i].toString() === b[i].toString()) {
            continue
          }

          // Compare non-containers; queue non-reference-equal containers
          if (!breadthFirstCompareChild(a[i], b[i])) {
            return false
          }
        }

        for (i in b) {

          // Collect b's properties
          bProperties.push(i)
        }

        // Ensures identical properties name
        return typeEquiv(aProperties.sort(), bProperties.sort())
      }
    }

    function typeEquiv(a, b) {
      var type = objectType(a)

      // Callbacks for containers will append to the pairs queue to achieve breadth-first
      // search order. The pairs queue is also used to avoid reprocessing any pair of
      // containers that are reference-equal to a previously visited pair (a special case
      // this being recursion detection).
      //
      // Because of this approach, once typeEquiv returns a false value, it should not be
      // called again without clearing the pair queue else it may wrongly report a visited
      // pair as being equivalent.
      return objectType(b) === type && callbacks[type](a, b)
    }

    function innerEquiv(a, b) {
      var i, pair

      // We're done when there's nothing more to compare
      if (arguments.length < 2) {
        return true
      }

      // Clear the global pair queue and add the top-level values being compared
      pairs = [{ a: a, b: b }]

      for (i = 0; i < pairs.length; i++) {
        pair = pairs[i]

        // Perform type-specific comparison on any pairs that are not strictly
        // equal. For container types, that comparison will postpone comparison
        // of any sub-container pair to the end of the pair queue. This gives
        // breadth-first search order. It also avoids the reprocessing of
        // reference-equal siblings, cousins etc, which can have a significant speed
        // impact when comparing a container of small objects each of which has a
        // reference to the same (singleton) large object.
        if (pair.a !== pair.b && !typeEquiv(pair.a, pair.b)) {
          return false
        }
      }

      // ...across all consecutive argument pairs
      return arguments.length === 2 || innerEquiv.apply(this, [].slice.call(arguments, 1))
    }

    return function() {
      var result = innerEquiv.apply(undefined, arguments)

      // Release any retained objects
      pairs.length = 0
      return result
    }
  })()

  /**
     * Config object: Maintain internal state
     * Later exposed as QUnit.config
     * `config` initialized at top of scope
     */
  var config = {

    // The queue of tests to run
    queue: [],

    // By default, run previously failed tests first
    // very useful in combination with "Hide passed tests" checked
    reorder: true,

    // Depth up-to which object will be dumped
    maxDepth: 5,

    // When enabled, all tests must call expect()
    requireExpects: false,

    // Set of all modules.
    modules: [],

    // The first unnamed module
    currentModule: {
      name: '',
      tests: [],
      childModules: [],
      testsRun: 0,
      unskippedTestsRun: 0,
      hooks: {
        before: [],
        beforeEach: [],
        afterEach: [],
        after: []
      }
    },

    callbacks: {}
  }

  // Push a loose unnamed module to the modules collection
  config.modules.push(config.currentModule)

  // Based on jsDump by Ariel Flesler
  // http://flesler.blogspot.com/2008/05/jsdump-pretty-dump-of-any-javascript.html
  var dump = (function() {
    function quote(str) {
      return '"' + str.toString().replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
    }
    function literal(o) {
      return o + ''
    }
    function join(pre, arr, post) {
      var s = dump.separator(),
          base = dump.indent(),
          inner = dump.indent(1)
      if (arr.join) {
        arr = arr.join(',' + s + inner)
      }
      if (!arr) {
        return pre + post
      }
      return [pre, inner + arr, base + post].join(s)
    }
    function array(arr, stack) {
      var i = arr.length,
          ret = new Array(i)

      if (dump.maxDepth && dump.depth > dump.maxDepth) {
        return '[object Array]'
      }

      this.up()
      while (i--) {
        ret[i] = this.parse(arr[i], undefined, stack)
      }
      this.down()
      return join('[', ret, ']')
    }

    function isArray(obj) {
      return (

      // Native Arrays
        toString.call(obj) === '[object Array]' ||

                // NodeList objects
                typeof obj.length === 'number' && obj.item !== undefined && (obj.length ? obj.item(0) === obj[0] : obj.item(0) === null && obj[0] === undefined)
      )
    }

    var reName = /^function (\w+)/,
        dump = {

          // The objType is used mostly internally, you can fix a (custom) type in advance
          parse: function parse(obj, objType, stack) {
            stack = stack || []
            var res,
                parser,
                parserType,
                objIndex = stack.indexOf(obj)

            if (objIndex !== -1) {
              return 'recursion(' + (objIndex - stack.length) + ')'
            }

            objType = objType || this.typeOf(obj)
            parser = this.parsers[objType]
            parserType = typeof parser === 'undefined' ? 'undefined' : _typeof(parser)

            if (parserType === 'function') {
              stack.push(obj)
              res = parser.call(this, obj, stack)
              stack.pop()
              return res
            }
            return parserType === 'string' ? parser : this.parsers.error
          },
          typeOf: function typeOf(obj) {
            var type

            if (obj === null) {
              type = 'null'
            } else if (typeof obj === 'undefined') {
              type = 'undefined'
            } else if (is('regexp', obj)) {
              type = 'regexp'
            } else if (is('date', obj)) {
              type = 'date'
            } else if (is('function', obj)) {
              type = 'function'
            } else if (isArray(obj)) {
              type = 'array'
            } else if (obj.constructor === Error.prototype.constructor) {
              type = 'error'
            } else {
              type = typeof obj === 'undefined' ? 'undefined' : _typeof(obj)
            }
            return type
          },

          separator: function separator() {
            if (this.multiline) {
              return this.HTML ? '<br />' : '\n'
            } else {
              return this.HTML ? '&#160;' : ' '
            }
          },

          // Extra can be a number, shortcut for increasing-calling-decreasing
          indent: function indent(extra) {
            if (!this.multiline) {
              return ''
            }
            var chr = this.indentChar
            if (this.HTML) {
              chr = chr.replace(/\t/g, '   ').replace(/ /g, '&#160;')
            }
            return new Array(this.depth + (extra || 0)).join(chr)
          },
          up: function up(a) {
            this.depth += a || 1
          },
          down: function down(a) {
            this.depth -= a || 1
          },
          setParser: function setParser(name, parser) {
            this.parsers[name] = parser
          },

          // The next 3 are exposed so you can use them
          quote: quote,
          literal: literal,
          join: join,
          depth: 1,
          maxDepth: config.maxDepth,

          // This is the list of parsers, to modify them, use dump.setParser
          parsers: {
            error: function error(_error) {
              return 'Error("' + _error.message + '")'
            },
            unknown: '[Unknown]',
            'null': 'null',
            'undefined': 'undefined',
            'function': function _function(fn) {
              var ret = 'function',

                  // Functions never have name in IE
                  name = 'name' in fn ? fn.name : (reName.exec(fn) || [])[1]

              if (name) {
                ret += ' ' + name
              }
              ret += '('

              ret = [ret, dump.parse(fn, 'functionArgs'), '){'].join('')
              return join(ret, dump.parse(fn, 'functionCode'), '}')
            },
            array: array,
            nodelist: array,
            'arguments': array,
            object: function object(map, stack) {
              var keys,
                  key,
                  val,
                  i,
                  nonEnumerableProperties,
                  ret = []

              if (dump.maxDepth && dump.depth > dump.maxDepth) {
                return '[object Object]'
              }

              dump.up()
              keys = []
              for (key in map) {
                keys.push(key)
              }

              // Some properties are not always enumerable on Error objects.
              nonEnumerableProperties = ['message', 'name']
              for (i in nonEnumerableProperties) {
                key = nonEnumerableProperties[i]
                if (key in map && !inArray(key, keys)) {
                  keys.push(key)
                }
              }
              keys.sort()
              for (i = 0; i < keys.length; i++) {
                key = keys[i]
                val = map[key]
                ret.push(dump.parse(key, 'key') + ': ' + dump.parse(val, undefined, stack))
              }
              dump.down()
              return join('{', ret, '}')
            },
            node: function node(_node) {
              var len,
                  i,
                  val,
                  open = dump.HTML ? '&lt;' : '<',
                  close = dump.HTML ? '&gt;' : '>',
                  tag = _node.nodeName.toLowerCase(),
                  ret = open + tag,
                  attrs = _node.attributes

              if (attrs) {
                for (i = 0, len = attrs.length; i < len; i++) {
                  val = attrs[i].nodeValue

                  // IE6 includes all attributes in .attributes, even ones not explicitly
                  // set. Those have values like undefined, null, 0, false, "" or
                  // "inherit".
                  if (val && val !== 'inherit') {
                    ret += ' ' + attrs[i].nodeName + '=' + dump.parse(val, 'attribute')
                  }
                }
              }
              ret += close

              // Show content of TextNode or CDATASection
              if (_node.nodeType === 3 || _node.nodeType === 4) {
                ret += _node.nodeValue
              }

              return ret + open + '/' + tag + close
            },

            // Function calls it internally, it's the arguments part of the function
            functionArgs: function functionArgs(fn) {
              var args,
                  l = fn.length

              if (!l) {
                return ''
              }

              args = new Array(l)
              while (l--) {

                // 97 is 'a'
                args[l] = String.fromCharCode(97 + l)
              }
              return ' ' + args.join(', ') + ' '
            },

            // Object calls it internally, the key part of an item in a map
            key: quote,

            // Function calls it internally, it's the content of the function
            functionCode: '[code]',

            // Node calls it internally, it's a html attribute value
            attribute: quote,
            string: quote,
            date: quote,
            regexp: literal,
            number: literal,
            'boolean': literal,
            symbol: function symbol(sym) {
              return sym.toString()
            }
          },

          // If true, entities are escaped ( <, >, \t, space and \n )
          HTML: false,

          // Indentation unit
          indentChar: '  ',

          // If true, items in a collection, are separated by a \n, else just a space.
          multiline: true
        }

    return dump
  })()

  var LISTENERS = Object.create(null)
  var SUPPORTED_EVENTS = ['runStart', 'suiteStart', 'testStart', 'assertion', 'testEnd', 'suiteEnd', 'runEnd']

  /**
     * Emits an event with the specified data to all currently registered listeners.
     * Callbacks will fire in the order in which they are registered (FIFO). This
     * function is not exposed publicly; it is used by QUnit internals to emit
     * logging events.
     *
     * @private
     * @method emit
     * @param {String} eventName
     * @param {Object} data
     * @return {Void}
     */
  function emit(eventName, data) {
    if (objectType(eventName) !== 'string') {
      throw new TypeError('eventName must be a string when emitting an event')
    }

    // Clone the callbacks in case one of them registers a new callback
    var originalCallbacks = LISTENERS[eventName]
    var callbacks = originalCallbacks ? [].concat(toConsumableArray(originalCallbacks)) : []

    for (var i = 0; i < callbacks.length; i++) {
      callbacks[i](data)
    }
  }

  /**
     * Registers a callback as a listener to the specified event.
     *
     * @public
     * @method on
     * @param {String} eventName
     * @param {Function} callback
     * @return {Void}
     */
  function on(eventName, callback) {
    if (objectType(eventName) !== 'string') {
      throw new TypeError('eventName must be a string when registering a listener')
    } else if (!inArray(eventName, SUPPORTED_EVENTS)) {
      var events = SUPPORTED_EVENTS.join(', ')
      throw new Error('"' + eventName + '" is not a valid event; must be one of: ' + events + '.')
    } else if (objectType(callback) !== 'function') {
      throw new TypeError('callback must be a function when registering a listener')
    }

    if (!LISTENERS[eventName]) {
      LISTENERS[eventName] = []
    }

    // Don't register the same callback more than once
    if (!inArray(callback, LISTENERS[eventName])) {
      LISTENERS[eventName].push(callback)
    }
  }

  // Register logging callbacks
  function registerLoggingCallbacks(obj) {
    var i,
        l,
        key,
        callbackNames = ['begin', 'done', 'log', 'testStart', 'testDone', 'moduleStart', 'moduleDone']

    function registerLoggingCallback(key) {
      var loggingCallback = function loggingCallback(callback) {
        if (objectType(callback) !== 'function') {
          throw new Error('QUnit logging methods require a callback function as their first parameters.')
        }

        config.callbacks[key].push(callback)
      }

      return loggingCallback
    }

    for (i = 0, l = callbackNames.length; i < l; i++) {
      key = callbackNames[i]

      // Initialize key collection of logging callback
      if (objectType(config.callbacks[key]) === 'undefined') {
        config.callbacks[key] = []
      }

      obj[key] = registerLoggingCallback(key)
    }
  }

  function runLoggingCallbacks(key, args) {
    var i, l, callbacks

    callbacks = config.callbacks[key]
    for (i = 0, l = callbacks.length; i < l; i++) {
      callbacks[i](args)
    }
  }

  // Doesn't support IE9, it will return undefined on these browsers
  // See also https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error/Stack
  var fileName = (sourceFromStacktrace(0) || '').replace(/(:\d+)+\)?/, '').replace(/.+\//, '')

  function extractStacktrace(e, offset) {
    offset = offset === undefined ? 4 : offset

    var stack, include, i

    if (e && e.trace) {
      stack = e.trace.split('\n')
      if (/^error$/i.test(stack[0])) {
        stack.shift()
      }
      if (fileName) {
        include = []
        for (i = offset; i < stack.length; i++) {
          if (stack[i].indexOf(fileName) !== -1) {
            break
          }
          include.push(stack[i])
        }
        if (include.length) {
          return include.join('\n')
        }
      }
      return stack[offset]
    }
  }

  function sourceFromStacktrace(offset) {
    var error = new Error()

    // Support: Safari <=7 only, IE <=10 - 11 only
    // Not all browsers generate the `stack` property for `new Error()`, see also #636
    if (!error.trace) {
      try {
        throw error
      } catch (err) {
        error = err
      }
    }

    return extractStacktrace(error, offset)
  }

  var priorityCount = 0
  var unitSampler = void 0

  /**
     * Advances the ProcessingQueue to the next item if it is ready.
     * @param {Boolean} last
     */
  function advance() {
    var start = now()
    config.depth = (config.depth || 0) + 1

    while (config.queue.length) {
      var elapsedTime = now() - start

      if (priorityCount > 0) {
        priorityCount--
      }
      config.queue.shift()()

    }

    config.depth--

    if (!config.queue.length && config.depth === 0) {
      done()
    }
  }

  function addToQueueImmediate(callback) {
    if (objectType(callback) === 'array') {
      while (callback.length) {
        addToQueueImmediate(callback.pop())
      }

      return
    }

    config.queue.unshift(callback)
    priorityCount++
  }

  /**
     * Adds a function to the ProcessingQueue for execution.
     * @param {Function|Array} callback
     * @param {Boolean} priority
     * @param {String} seed
     */
  function addToQueue(callback, prioritize, seed) {
    if (prioritize) {
      config.queue.splice(priorityCount++, 0, callback)
    } else if (seed) {
      if (!unitSampler) {
        unitSampler = unitSamplerGenerator(seed)
      }

      // Insert into a random position after all prioritized items
      var index = Math.floor(unitSampler() * (config.queue.length - priorityCount + 1))
      config.queue.splice(priorityCount + index, 0, callback)
    } else {
      config.queue.push(callback)
    }
  }

  /**
     * Creates a seeded "sample" generator which is used for randomizing tests.
     */
  function unitSamplerGenerator(seed) {

    // 32-bit xorshift, requires only a nonzero seed
    // http://excamera.com/sphinx/article-xorshift.html
    var sample = parseInt(generateHash(seed), 16) || -1
    return function() {
      sample ^= sample << 13
      sample ^= sample >>> 17
      sample ^= sample << 5

      // ECMAScript has no unsigned number type
      if (sample < 0) {
        sample += 0x100000000
      }

      return sample / 0x100000000
    }
  }

  /**
     * This function is called when the ProcessingQueue is done processing all
     * items. It handles emitting the final run events.
     */
  function done() {

    ProcessingQueue.finished = true

    var runtime = now() - config.started
    var passed = config.stats.all - config.stats.bad

    emit('runEnd', globalSuite.end(true))
    runLoggingCallbacks('done', {
      passed: passed,
      failed: config.stats.bad,
      total: config.stats.all,
      runtime: runtime
    })

  }

  var ProcessingQueue = {
    finished: false,
    add: addToQueue,
    addImmediate: addToQueueImmediate,
    advance: advance
  }

  var TestReport = (function() {
    function TestReport(name, suite, options) {
      classCallCheck(this, TestReport)

      this.name = name
      this.suiteName = suite.name
      this.fullName = suite.fullName.concat(name)
      this.runtime = 0
      this.assertions = []

      this.skipped = !!options.skip
      this.todo = !!options.todo

      this.valid = options.valid

      this._startTime = 0
      this._endTime = 0

      suite.pushTest(this)
    }

    createClass(TestReport, [{
      key: 'start',
      value: function start(recordTime) {
        if (recordTime) {
          this._startTime = Date.now()
        }

        return {
          name: this.name,
          suiteName: this.suiteName,
          fullName: this.fullName.slice()
        }
      }
    }, {
      key: 'end',
      value: function end(recordTime) {
        if (recordTime) {
          this._endTime = Date.now()
        }

        return extend(this.start(), {
          runtime: this.getRuntime(),
          status: this.getStatus(),
          errors: this.getFailedAssertions(),
          assertions: this.getAssertions()
        })
      }
    }, {
      key: 'pushAssertion',
      value: function pushAssertion(assertion) {
        this.assertions.push(assertion)
      }
    }, {
      key: 'getRuntime',
      value: function getRuntime() {
        return this._endTime - this._startTime
      }
    }, {
      key: 'getStatus',
      value: function getStatus() {
        if (this.skipped) {
          return 'skipped'
        }

        var testPassed = this.getFailedAssertions().length > 0 ? this.todo : !this.todo

        if (!testPassed) {
          return 'failed'
        } else if (this.todo) {
          return 'todo'
        } else {
          return 'passed'
        }
      }
    }, {
      key: 'getFailedAssertions',
      value: function getFailedAssertions() {
        return this.assertions.filter(function(assertion) {
          return !assertion.passed
        })
      }
    }, {
      key: 'getAssertions',
      value: function getAssertions() {
        return this.assertions.slice()
      }

      // Remove actual and expected values from assertions. This is to prevent
      // leaking memory throughout a test suite.

    }, {
      key: 'slimAssertions',
      value: function slimAssertions() {
        this.assertions = this.assertions.map(function(assertion) {
          delete assertion.actual
          delete assertion.expected
          return assertion
        })
      }
    }])
    return TestReport
  }())

  var focused$1 = false

  function Test(settings) {
    var i, l

    ++Test.count

    this.expected = null
    this.assertions = []
    this.semaphore = 0
    this.module = config.currentModule
    this.stack = sourceFromStacktrace(3)
    this.steps = []

    // If a module is skipped, all its tests and the tests of the child suites
    // should be treated as skipped even if they are defined as `only` or `todo`.
    // As for `todo` module, all its tests will be treated as `todo` except for
    // tests defined as `skip` which will be left intact.
    //
    // So, if a test is defined as `todo` and is inside a skipped module, we should
    // then treat that test as if was defined as `skip`.
    if (this.module.skip) {
      settings.skip = true
      settings.todo = false

      // Skipped tests should be left intact
    } else if (this.module.todo && !settings.skip) {
      settings.todo = true
    }

    extend(this, settings)

    this.testReport = new TestReport(settings.testName, this.module.suiteReport, {
      todo: settings.todo,
      skip: settings.skip,
      valid: this.valid()
    })

    // Register unique strings
    for (i = 0, l = this.module.tests; i < l.length; i++) {
      if (this.module.tests[i].name === this.testName) {
        this.testName += ' '
      }
    }

    this.testId = generateHash(this.module.name, this.testName)

    this.module.tests.push({
      name: this.testName,
      testId: this.testId,
      skip: !!settings.skip
    })

    if (settings.skip) {

      // Skipped tests will fully ignore any sent callback
      this.callback = function() {}
      this.expected = 0
    } else {
      this.assert = new Assert(this)
    }
  }

  Test.count = 0

  function getNotStartedModules(startModule) {
    var module = startModule,
        modules = []

    while (module && module.testsRun === 0) {
      modules.push(module)
      module = module.parentModule
    }

    return modules
  }

  Test.prototype = {
    before: function before() {
      var i,
          startModule,
          module = this.module,
          notStartedModules = getNotStartedModules(module)

      for (i = notStartedModules.length - 1; i >= 0; i--) {
        startModule = notStartedModules[i]
        startModule.stats = { all: 0, bad: 0, started: now() }
        emit('suiteStart', startModule.suiteReport.start(true))
        runLoggingCallbacks('moduleStart', {
          name: startModule.name,
          tests: startModule.tests
        })
      }

      config.current = this

      this.testEnvironment = extend({}, module.testEnvironment)

      this.started = now()
      emit('testStart', this.testReport.start(true))
      runLoggingCallbacks('testStart', {
        name: this.testName,
        module: module.name,
        testId: this.testId
      })

      if (!config.pollution) {
        saveGlobal()
      }
    },

    run: function run() {

      config.current = this

      if (config.notrycatch) {
        runTest(this)
        return
      }

      try {
        runTest(this)
      } catch (e) {
        this.pushFailure('Died on test #' + (this.assertions.length + 1) + ' ' + this.stack + ': ' + (e.message || e), extractStacktrace(e, 0))

        // Else next test will carry the responsibility
        saveGlobal()

      }

      function runTest(test) {
        test.callback.call(test.testEnvironment, test.assert)
      }
    },

    after: function after() {
      checkPollution()
    },

    queueHook: function queueHook(hook, hookName, hookOwner) {
      var _this = this

      var callHook = function callHook() {
        hook.call(_this.testEnvironment, _this.assert)
      }

      var runHook = function runHook() {
        if (hookName === 'before') {
          if (hookOwner.unskippedTestsRun !== 0) {
            return
          }

          _this.preserveEnvironment = true
        }

        if (hookName === 'after' && hookOwner.unskippedTestsRun !== numberOfUnskippedTests(hookOwner) - 1 && config.queue.length > 2) {
          return
        }

        config.current = _this
        if (config.notrycatch) {
          callHook()
          return
        }
        try {
          callHook()
        } catch (error) {
          _this.pushFailure(hookName + ' failed on ' + _this.testName + ': ' + (error.message || error), extractStacktrace(error, 0))
        }
      }

      return runHook
    },

    // Currently only used for module level hooks, can be used to add global level ones
    hooks: function hooks(handler) {
      var hooks = []

      function processHooks(test, module) {
        if (module.parentModule) {
          processHooks(test, module.parentModule)
        }

        if (module.hooks[handler].length) {
          for (var i = 0; i < module.hooks[handler].length; i++) {
            hooks.push(test.queueHook(module.hooks[handler][i], handler, module))
          }
        }
      }

      // Hooks are ignored on skipped tests
      if (!this.skip) {
        processHooks(this, this.module)
      }

      return hooks
    },

    finish: function finish() {
      config.current = this
      if (config.requireExpects && this.expected === null) {
        this.pushFailure('Expected number of assertions to be defined, but expect() was ' + 'not called.', this.stack)
      } else if (this.expected !== null && this.expected !== this.assertions.length) {
        this.pushFailure('Expected ' + this.expected + ' assertions, but ' + this.assertions.length + ' were run', this.stack)
      } else if (this.expected === null && !this.assertions.length) {
        this.pushFailure('Expected at least one assertion, but none were run - call ' + 'expect(0) to accept zero assertions.', this.stack)
      }

      var i,
          module = this.module,
          moduleName = module.name,
          testName = this.testName,
          skipped = !!this.skip,
          todo = !!this.todo,
          bad = 0

      this.runtime = now() - this.started

      config.stats.all += this.assertions.length
      module.stats.all += this.assertions.length

      for (i = 0; i < this.assertions.length; i++) {
        if (!this.assertions[i].result) {
          bad++
          config.stats.bad++
          module.stats.bad++
        }
      }

      notifyTestsRan(module, skipped)

      // After emitting the js-reporters event we cleanup the assertion data to
      // avoid leaking it. It is not used by the legacy testDone callbacks.
      emit('testEnd', this.testReport.end(true))
      this.testReport.slimAssertions()

      runLoggingCallbacks('testDone', {
        name: testName,
        module: moduleName,
        skipped: skipped,
        todo: todo,
        failed: bad,
        passed: this.assertions.length - bad,
        total: this.assertions.length,
        runtime: skipped ? 0 : this.runtime,

        // HTML Reporter use
        assertions: this.assertions,
        testId: this.testId,

        // Source of Test
        source: this.stack
      })

      if (module.testsRun === numberOfTests(module)) {
        logSuiteEnd(module)

        // Check if the parent modules, iteratively, are done. If that the case,
        // we emit the `suiteEnd` event and trigger `moduleDone` callback.
        var parent = module.parentModule
        while (parent && parent.testsRun === numberOfTests(parent)) {
          logSuiteEnd(parent)
          parent = parent.parentModule
        }
      }

      config.current = undefined

      function logSuiteEnd(module) {
        emit('suiteEnd', module.suiteReport.end(true))
        runLoggingCallbacks('moduleDone', {
          name: module.name,
          tests: module.tests,
          failed: module.stats.bad,
          passed: module.stats.all - module.stats.bad,
          total: module.stats.all,
          runtime: now() - module.stats.started
        })
      }
    },

    preserveTestEnvironment: function preserveTestEnvironment() {
      if (this.preserveEnvironment) {
        this.module.testEnvironment = this.testEnvironment
        this.testEnvironment = extend({}, this.module.testEnvironment)
      }
    },

    queue: function queue() {
      var test = this

      if (!this.valid()) {
        return
      }

      function runTest() {

        // Each of these can by async
        ProcessingQueue.addImmediate([function() {
          test.before()
        }, test.hooks('before'), function() {
          test.preserveTestEnvironment()
        }, test.hooks('beforeEach'), function() {
          test.run()
        }, test.hooks('afterEach').reverse(), test.hooks('after').reverse(), function() {
          test.after()
        }, function() {
          test.finish()
        }])
      }

      ProcessingQueue.add(runTest, false, config.seed)

      // If the queue has already finished, we manually process the new test
      if (ProcessingQueue.finished) {
        ProcessingQueue.advance()
      }
    },

    pushResult: function pushResult(resultInfo) {
      if (this !== config.current) {
        throw new Error('Assertion occured after test had finished.')
      }

      // Destructure of resultInfo = { result, actual, expected, message, negative }
      var source,
          details = {
            module: this.module.name,
            name: this.testName,
            result: resultInfo.result,
            message: resultInfo.message,
            actual: resultInfo.actual,
            expected: resultInfo.expected,
            testId: this.testId,
            negative: resultInfo.negative || false,
            runtime: now() - this.started,
            todo: !!this.todo
          }

      if (!resultInfo.result) {
        source = resultInfo.source || sourceFromStacktrace()

        if (source) {
          details.source = source
        }
      }

      this.logAssertion(details)

      this.assertions.push({
        result: !!resultInfo.result,
        message: resultInfo.message
      })
    },

    pushFailure: function pushFailure(message, source, actual) {
      if (!(this instanceof Test)) {
        throw new Error('pushFailure() assertion outside test context, was ' + sourceFromStacktrace(2))
      }

      this.pushResult({
        result: false,
        message: message || 'error',
        actual: actual || null,
        expected: null,
        source: source
      })
    },

    /**
         * Log assertion details using both the old QUnit.log interface and
         * QUnit.on( "assertion" ) interface.
         *
         * @private
         */
    logAssertion: function logAssertion(details) {
      runLoggingCallbacks('log', details)

      var assertion = {
        passed: details.result,
        actual: details.actual,
        expected: details.expected,
        message: details.message,
        stack: details.source,
        todo: details.todo
      }
      this.testReport.pushAssertion(assertion)
      emit('assertion', assertion)
    },

    valid: function valid() {
      var filter = config.filter,
          regexFilter = /^(!?)\/([\w\W]*)\/(i?$)/.exec(filter),
          module = config.module && config.module.toLowerCase(),
          fullName = this.module.name + ': ' + this.testName

      function moduleChainNameMatch(testModule) {
        var testModuleName = testModule.name ? testModule.name.toLowerCase() : null
        if (testModuleName === module) {
          return true
        } else if (testModule.parentModule) {
          return moduleChainNameMatch(testModule.parentModule)
        } else {
          return false
        }
      }

      function moduleChainIdMatch(testModule) {
        return inArray(testModule.moduleId, config.moduleId) || testModule.parentModule && moduleChainIdMatch(testModule.parentModule)
      }

      // Internally-generated tests are always valid
      if (this.callback && this.callback.validTest) {
        return true
      }

      if (config.moduleId && config.moduleId.length > 0 && !moduleChainIdMatch(this.module)) {

        return false
      }

      if (config.testId && config.testId.length > 0 && !inArray(this.testId, config.testId)) {

        return false
      }

      if (module && !moduleChainNameMatch(this.module)) {
        return false
      }

      if (!filter) {
        return true
      }

      return regexFilter ? this.regexFilter(!!regexFilter[1], regexFilter[2], regexFilter[3], fullName) : this.stringFilter(filter, fullName)
    },

    regexFilter: function regexFilter(exclude, pattern, flags, fullName) {
      var regex = new RegExp(pattern, flags)
      var match = regex.test(fullName)

      return match !== exclude
    },

    stringFilter: function stringFilter(filter, fullName) {
      filter = filter.toLowerCase()
      fullName = fullName.toLowerCase()

      var include = filter.charAt(0) !== '!'
      if (!include) {
        filter = filter.slice(1)
      }

      // If the filter matches, we need to honour include
      if (fullName.indexOf(filter) !== -1) {
        return include
      }

      // Otherwise, do the opposite
      return !include
    }
  }

  function pushFailure() {
    if (!config.current) {
      throw new Error('pushFailure() assertion outside test context, in ' + sourceFromStacktrace(2))
    }

    // Gets current test obj
    var currentTest = config.current

    return currentTest.pushFailure.apply(currentTest, arguments)
  }

  function saveGlobal() {
    config.pollution = []
    for (var key in global$1) {
      if (hasOwn.call(global$1, key)) {
        config.pollution.push(key)
      }
    }
  }

  function checkPollution() {
    var newGlobals,
        deletedGlobals,
        old = config.pollution

    saveGlobal()

    newGlobals = diff(config.pollution, old)
    if (newGlobals.length > 0) {
      pushFailure('Introduced global variable(s): ' + newGlobals.join(', '))
    }

    deletedGlobals = diff(old, config.pollution)
    if (deletedGlobals.length > 0) {
      pushFailure('Deleted global variable(s): ' + deletedGlobals.join(', '))
    }
  }

  // Will be exposed as QUnit.test
  function test(testName, callback) {
    if (focused$1) {
      return
    }

    var newTest = new Test({
      testName: testName,
      callback: callback
    })

    newTest.queue()
  }

  function todo(testName, callback) {
    if (focused$1) {
      return
    }

    var newTest = new Test({
      testName: testName,
      callback: callback,
      todo: true
    })

    newTest.queue()
  }

  // Will be exposed as QUnit.skip
  function skip(testName) {
    if (focused$1) {
      return
    }

    var test = new Test({
      testName: testName,
      skip: true
    })

    test.queue()
  }

  // Will be exposed as QUnit.only
  function only(testName, callback) {
    if (focused$1) {
      return
    }

    config.queue.length = 0
    focused$1 = true

    var newTest = new Test({
      testName: testName,
      callback: callback
    })

    newTest.queue()
  }

  function collectTests(module) {
    var tests = [].concat(module.tests)
    var modules = [].concat(toConsumableArray(module.childModules))

    // Do a breadth-first traversal of the child modules
    while (modules.length) {
      var nextModule = modules.shift()
      tests.push.apply(tests, nextModule.tests)
      modules.push.apply(modules, toConsumableArray(nextModule.childModules))
    }

    return tests
  }

  function numberOfTests(module) {
    return collectTests(module).length
  }

  function numberOfUnskippedTests(module) {
    return collectTests(module).filter(function(test) {
      return !test.skip
    }).length
  }

  function notifyTestsRan(module, skipped) {
    module.testsRun++
    if (!skipped) {
      module.unskippedTestsRun++
    }
    while (module = module.parentModule) {
      module.testsRun++
      if (!skipped) {
        module.unskippedTestsRun++
      }
    }
  }

  var Assert = (function() {
    function Assert(testContext) {
      classCallCheck(this, Assert)

      this.test = testContext
    }

    // Assert helpers

    createClass(Assert, [{
      key: 'step',
      value: function step(message) {
        var result = !!message

        this.test.steps.push(message)

        return this.pushResult({
          result: result,
          message: message || 'You must provide a message to assert.step'
        })
      }

      // Verifies the steps in a test match a given array of string values

    }, {
      key: 'verifySteps',
      value: function verifySteps(steps, message) {
        this.deepEqual(this.test.steps, steps, message)
      }

      // Specify the number of expected assertions to guarantee that failed test
      // (no assertions are run at all) don't slip through.

    }, {
      key: 'expect',
      value: function expect(asserts) {
        if (arguments.length === 1) {
          this.test.expected = asserts
        } else {
          return this.test.expected
        }
      }

      // Put a hold on processing and return a function that will release it a maximum of once.

    }, {
      key: 'pushResult',
      value: function pushResult(resultInfo) {

        // Destructure of resultInfo = { result, actual, expected, message, negative }
        var assert = this
        var currentTest = assert instanceof Assert && assert.test || config.current

        // Backwards compatibility fix.
        // Allows the direct use of global exported assertions and QUnit.assert.*
        // Although, it's use is not recommended as it can leak assertions
        // to other tests from async tests, because we only get a reference to the current test,
        // not exactly the test where assertion were intended to be called.
        if (!currentTest) {
          throw new Error('assertion outside test context, in ' + sourceFromStacktrace(2))
        }

        if (!(assert instanceof Assert)) {
          assert = currentTest.assert
        }

        return assert.test.pushResult(resultInfo)
      }
    }, {
      key: 'ok',
      value: function ok(result, message) {
        if (!message) {
          message = result ? 'okay' : 'failed, expected argument to be truthy, was: ' + dump.parse(result)
        }

        this.pushResult({
          result: !!result,
          actual: result,
          expected: true,
          message: message
        })
      }
    }, {
      key: 'notOk',
      value: function notOk(result, message) {
        if (!message) {
          message = !result ? 'okay' : 'failed, expected argument to be falsy, was: ' + dump.parse(result)
        }

        this.pushResult({
          result: !result,
          actual: result,
          expected: false,
          message: message
        })
      }
    }, {
      key: 'equal',
      value: function equal(actual, expected, message) {

        // eslint-disable-next-line eqeqeq
        var result = expected == actual

        this.pushResult({
          result: result,
          actual: actual,
          expected: expected,
          message: message
        })
      }
    }, {
      key: 'notEqual',
      value: function notEqual(actual, expected, message) {

        // eslint-disable-next-line eqeqeq
        var result = expected != actual

        this.pushResult({
          result: result,
          actual: actual,
          expected: expected,
          message: message,
          negative: true
        })
      }
    }, {
      key: 'propEqual',
      value: function propEqual(actual, expected, message) {
        actual = objectValues(actual)
        expected = objectValues(expected)

        this.pushResult({
          result: equiv(actual, expected),
          actual: actual,
          expected: expected,
          message: message
        })
      }
    }, {
      key: 'notPropEqual',
      value: function notPropEqual(actual, expected, message) {
        actual = objectValues(actual)
        expected = objectValues(expected)

        this.pushResult({
          result: !equiv(actual, expected),
          actual: actual,
          expected: expected,
          message: message,
          negative: true
        })
      }
    }, {
      key: 'deepEqual',
      value: function deepEqual(actual, expected, message) {
        this.pushResult({
          result: equiv(actual, expected),
          actual: actual,
          expected: expected,
          message: message
        })
      }
    }, {
      key: 'notDeepEqual',
      value: function notDeepEqual(actual, expected, message) {
        this.pushResult({
          result: !equiv(actual, expected),
          actual: actual,
          expected: expected,
          message: message,
          negative: true
        })
      }
    }, {
      key: 'strictEqual',
      value: function strictEqual(actual, expected, message) {
        this.pushResult({
          result: expected === actual,
          actual: actual,
          expected: expected,
          message: message
        })
      }
    }, {
      key: 'notStrictEqual',
      value: function notStrictEqual(actual, expected, message) {
        this.pushResult({
          result: expected !== actual,
          actual: actual,
          expected: expected,
          message: message,
          negative: true
        })
      }
    }, {
      key: 'throws',
      value: function throws(block, expected, message) {
        var actual = void 0,
            result = false

        var currentTest = this instanceof Assert && this.test || config.current

        // 'expected' is optional unless doing string comparison
        if (objectType(expected) === 'string') {
          if (message == null) {
            message = expected
            expected = null
          } else {
            throw new Error('throws/raises does not accept a string value for the expected argument.\n' + "Use a non-string object value (e.g. regExp) instead if it's necessary.")
          }
        }

        currentTest.ignoreGlobalErrors = true
        try {
          block.call(currentTest.testEnvironment)
        } catch (e) {
          actual = e
        }
        currentTest.ignoreGlobalErrors = false

        if (actual) {
          var expectedType = objectType(expected)

          // We don't want to validate thrown error
          if (!expected) {
            result = true
            expected = null

            // Expected is a regexp
          } else if (expectedType === 'regexp') {
            result = expected.test(errorString(actual))

            // Expected is a constructor, maybe an Error constructor
          } else if (expectedType === 'function' && actual instanceof expected) {
            result = true

            // Expected is an Error object
          } else if (expectedType === 'object') {
            result = actual instanceof expected.constructor && actual.name === expected.name && actual.message === expected.message

            // Expected is a validation function which returns true if validation passed
          } else if (expectedType === 'function' && expected.call({}, actual) === true) {
            expected = null
            result = true
          }
        }

        currentTest.assert.pushResult({
          result: result,
          actual: actual,
          expected: expected,
          message: message
        })
      }
    }])
    return Assert
  }())

  // Provide an alternative to assert.throws(), for environments that consider throws a reserved word
  // Known to us are: Closure Compiler, Narwhal
  // eslint-disable-next-line dot-notation

  Assert.prototype.raises = Assert.prototype['throws']

  /**
     * Converts an error into a simple string for comparisons.
     *
     * @param {Error} error
     * @return {String}
     */
  function errorString(error) {
    var resultErrorString = error.toString()

    if (resultErrorString.substring(0, 7) === '[object') {
      var name = error.name ? error.name.toString() : 'Error'
      var message = error.message ? error.message.toString() : ''

      if (name && message) {
        return name + ': ' + message
      } else if (name) {
        return name
      } else if (message) {
        return message
      } else {
        return 'Error'
      }
    } else {
      return resultErrorString
    }
  }

  /* global module, exports, define */
  function exportQUnit(QUnit) {
    module.exports = QUnit
  }

  var SuiteReport = (function() {
    function SuiteReport(name, parentSuite) {
      classCallCheck(this, SuiteReport)

      this.name = name
      this.fullName = parentSuite ? parentSuite.fullName.concat(name) : []

      this.tests = []
      this.childSuites = []

      if (parentSuite) {
        parentSuite.pushChildSuite(this)
      }
    }

    createClass(SuiteReport, [{
      key: 'start',
      value: function start(recordTime) {
        if (recordTime) {
          this._startTime = Date.now()
        }

        return {
          name: this.name,
          fullName: this.fullName.slice(),
          tests: this.tests.map(function(test) {
            return test.start()
          }),
          childSuites: this.childSuites.map(function(suite) {
            return suite.start()
          }),
          testCounts: {
            total: this.getTestCounts().total
          }
        }
      }
    }, {
      key: 'end',
      value: function end(recordTime) {
        if (recordTime) {
          this._endTime = Date.now()
        }

        return {
          name: this.name,
          fullName: this.fullName.slice(),
          tests: this.tests.map(function(test) {
            return test.end()
          }),
          childSuites: this.childSuites.map(function(suite) {
            return suite.end()
          }),
          testCounts: this.getTestCounts(),
          runtime: this.getRuntime(),
          status: this.getStatus()
        }
      }
    }, {
      key: 'pushChildSuite',
      value: function pushChildSuite(suite) {
        this.childSuites.push(suite)
      }
    }, {
      key: 'pushTest',
      value: function pushTest(test) {
        this.tests.push(test)
      }
    }, {
      key: 'getRuntime',
      value: function getRuntime() {
        return this._endTime - this._startTime
      }
    }, {
      key: 'getTestCounts',
      value: function getTestCounts() {
        var counts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { passed: 0, failed: 0, skipped: 0, todo: 0, total: 0 }

        counts = this.tests.reduce(function(counts, test) {
          if (test.valid) {
            counts[test.getStatus()]++
            counts.total++
          }

          return counts
        }, counts)

        return this.childSuites.reduce(function(counts, suite) {
          return suite.getTestCounts(counts)
        }, counts)
      }
    }, {
      key: 'getStatus',
      value: function getStatus() {
        var _getTestCounts = this.getTestCounts(),
            total = _getTestCounts.total,
            failed = _getTestCounts.failed,
            skipped = _getTestCounts.skipped,
            todo = _getTestCounts.todo

        if (failed) {
          return 'failed'
        } else {
          if (skipped === total) {
            return 'skipped'
          } else if (todo === total) {
            return 'todo'
          } else {
            return 'passed'
          }
        }
      }
    }])
    return SuiteReport
  }())

  // Handle an unhandled exception. By convention, returns true if further
  // error handling should be suppressed and false otherwise.
  // In this case, we will only suppress further error handling if the
  // "ignoreGlobalErrors" configuration option is enabled.
  function onError(error) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key]
    }

    if (config.current) {
      if (config.current.ignoreGlobalErrors) {
        return true
      }
      pushFailure.apply(undefined, [error.message, error.fileName + ':' + error.lineNumber].concat(args))
    } else {
      test('global failure', extend(function() {
        pushFailure.apply(undefined, [error.message, error.fileName + ':' + error.lineNumber].concat(args))
      }, { validTest: true }))
    }

    return false
  }

  var focused = false
  var QUnit = {}
  var globalSuite = new SuiteReport()

  // The initial "currentModule" represents the global (or top-level) module that
  // is not explicitly defined by the user, therefore we add the "globalSuite" to
  // it since each module has a suiteReport associated with it.
  config.currentModule.suiteReport = globalSuite

  var moduleStack = []
  var globalLoaded = false
  var runStarted = false

  // Figure out if we're running the tests from a server or not
  QUnit.isLocal = true

  // Expose the current QUnit version
  QUnit.version = '2.4.0'

  function createModule(name, testEnvironment, modifiers) {
    var parentModule = moduleStack.length ? moduleStack.slice(-1)[0] : null
    var moduleName = parentModule !== null ? [parentModule.name, name].join(' > ') : name
    var parentSuite = parentModule ? parentModule.suiteReport : globalSuite

    var skip$$1 = parentModule !== null && parentModule.skip || modifiers.skip
    var todo$$1 = parentModule !== null && parentModule.todo || modifiers.todo

    var module = {
      name: moduleName,
      parentModule: parentModule,
      tests: [],
      moduleId: generateHash(moduleName),
      testsRun: 0,
      unskippedTestsRun: 0,
      childModules: [],
      suiteReport: new SuiteReport(name, parentSuite),

      // Pass along `skip` and `todo` properties from parent module, in case
      // there is one, to childs. And use own otherwise.
      // This property will be used to mark own tests and tests of child suites
      // as either `skipped` or `todo`.
      skip: skip$$1,
      todo: skip$$1 ? false : todo$$1
    }

    var env = {}
    if (parentModule) {
      parentModule.childModules.push(module)
      extend(env, parentModule.testEnvironment)
    }
    extend(env, testEnvironment)
    module.testEnvironment = env

    config.modules.push(module)
    return module
  }

  function processModule(name, options, executeNow) {
    var modifiers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {}

    var module = createModule(name, options, modifiers)

    // Move any hooks to a 'hooks' object
    var testEnvironment = module.testEnvironment
    var hooks = module.hooks = {}

    setHookFromEnvironment(hooks, testEnvironment, 'before')
    setHookFromEnvironment(hooks, testEnvironment, 'beforeEach')
    setHookFromEnvironment(hooks, testEnvironment, 'afterEach')
    setHookFromEnvironment(hooks, testEnvironment, 'after')

    function setHookFromEnvironment(hooks, environment, name) {
      var potentialHook = environment[name]
      hooks[name] = typeof potentialHook === 'function' ? [potentialHook] : []
      delete environment[name]
    }

    var moduleFns = {
      before: setHookFunction(module, 'before'),
      beforeEach: setHookFunction(module, 'beforeEach'),
      afterEach: setHookFunction(module, 'afterEach'),
      after: setHookFunction(module, 'after')
    }

    var currentModule = config.currentModule
    if (objectType(executeNow) === 'function') {
      moduleStack.push(module)
      config.currentModule = module
      executeNow.call(module.testEnvironment, moduleFns)
      moduleStack.pop()
      module = module.parentModule || currentModule
    }

    config.currentModule = module
  }

  // TODO: extract this to a new file alongside its related functions
  function module$1(name, options, executeNow) {
    if (focused) {
      return
    }

    if (arguments.length === 2) {
      if (objectType(options) === 'function') {
        executeNow = options
        options = undefined
      }
    }

    processModule(name, options, executeNow)
  }

  module$1.only = function() {
    if (focused) {
      return
    }

    config.modules.length = 0
    config.queue.length = 0

    module$1.apply(undefined, arguments)

    focused = true
  }

  module$1.skip = function(name, options, executeNow) {
    if (focused) {
      return
    }

    if (arguments.length === 2) {
      if (objectType(options) === 'function') {
        executeNow = options
        options = undefined
      }
    }

    processModule(name, options, executeNow, { skip: true })
  }

  module$1.todo = function(name, options, executeNow) {
    if (focused) {
      return
    }

    if (arguments.length === 2) {
      if (objectType(options) === 'function') {
        executeNow = options
        options = undefined
      }
    }

    processModule(name, options, executeNow, { todo: true })
  }

  extend(QUnit, {
    on: on,

    module: module$1,

    test: test,

    todo: todo,

    skip: skip,

    only: only,

    start: function start(count) {

      if (!config.current) {

        if (runStarted) {
          throw new Error('Called start() while test already started running')
        } else if (count > 1) {
          throw new Error('Called start() outside of a test context too many times')
        } else if (!globalLoaded) {

          globalLoaded = true

          // Initialize the configuration options
          extend(config, {
            stats: { all: 0, bad: 0 },
            started: 0,
            updateRate: 1000,
            filter: ''
          }, true)

          scheduleBegin()

          return
        }
      } else {
        throw new Error('QUnit.start cannot be called inside a test context.')
      }

      scheduleBegin()
    },

    config: config,

    is: is,

    objectType: objectType,

    extend: extend,

    stack: function stack(offset) {
      offset = (offset || 0) + 2
      return sourceFromStacktrace(offset)
    },

    onError: onError
  })

  QUnit.pushFailure = pushFailure
  QUnit.assert = Assert.prototype
  QUnit.equiv = equiv
  QUnit.dump = dump

  registerLoggingCallbacks(QUnit)

  function scheduleBegin() {

    runStarted = true
    begin()

  }

  function begin() {
    var i,
        l,
        modulesLog = []

        // If the test run hasn't officially begun yet
    if (!config.started) {

      // Record the time of the test run's beginning
      config.started = now()

      // Delete the loose unnamed module if unused.
      if (config.modules[0].name === '' && config.modules[0].tests.length === 0) {
        config.modules.shift()
      }

      // Avoid unnecessary information by not logging modules' test environments
      for (i = 0, l = config.modules.length; i < l; i++) {
        modulesLog.push({
          name: config.modules[i].name,
          tests: config.modules[i].tests
        })
      }

      // The test run is officially beginning now
      emit('runStart', globalSuite.start(true))
      runLoggingCallbacks('begin', {
        totalTests: Test.count,
        modules: modulesLog
      })
    }

    ProcessingQueue.advance()
  }

  function setHookFunction(module, hookName) {
    return function setHook(callback) {
      module.hooks[hookName].push(callback)
    }
  }

  exportQUnit(QUnit)

  var stats = {
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    todoTests: 0
  }

  // Escape text for attribute or text content.
  function escapeText(s) {
    if (!s) {
      return ''
    }
    s = s + ''

    // Both single quotes and double quotes (for attributes)
    return s.replace(/['"<>&]/g, function(s) {
      switch (s) {
        case "'":
          return '&#039;'
        case '"':
          return '&quot;'
        case '<':
          return '&lt;'
        case '>':
          return '&gt;'
        case '&':
          return '&amp;'
      }
    })
  }

  /*
   * This file is a modified version of google-diff-match-patch's JavaScript implementation
   * (https://code.google.com/p/google-diff-match-patch/source/browse/trunk/javascript/diff_match_patch_uncompressed.js),
   * modifications are licensed as more fully set forth in LICENSE.txt.
   *
   * The original source of google-diff-match-patch is attributable and licensed as follows:
   *
   * Copyright 2006 Google Inc.
   * https://code.google.com/p/google-diff-match-patch/
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * https://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *
   * More Info:
   *  https://code.google.com/p/google-diff-match-patch/
   *
   * Usage: QUnit.diff(expected, actual)
   *
   */
  QUnit.diff = (function() {
    function DiffMatchPatch() {}

    //  DIFF FUNCTIONS

    /**
         * The data structure representing a diff is an array of tuples:
         * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
         * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
         */
    var DIFF_DELETE = -1,
        DIFF_INSERT = 1,
        DIFF_EQUAL = 0

        /**
         * Find the differences between two texts.  Simplifies the problem by stripping
         * any common prefix or suffix off the texts before diffing.
         * @param {string} text1 Old string to be diffed.
         * @param {string} text2 New string to be diffed.
         * @param {boolean=} optChecklines Optional speedup flag. If present and false,
         *     then don't run a line-level diff first to identify the changed areas.
         *     Defaults to true, which does a faster, slightly less optimal diff.
         * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
         */
    DiffMatchPatch.prototype.DiffMain = function(text1, text2, optChecklines) {
      var deadline, checklines, commonlength, commonprefix, commonsuffix, diffs

      // The diff must be complete in up to 1 second.
      deadline = new Date().getTime() + 1000

      // Check for null inputs.
      if (text1 === null || text2 === null) {
        throw new Error('Null input. (DiffMain)')
      }

      // Check for equality (speedup).
      if (text1 === text2) {
        if (text1) {
          return [[DIFF_EQUAL, text1]]
        }
        return []
      }

      if (typeof optChecklines === 'undefined') {
        optChecklines = true
      }

      checklines = optChecklines

      // Trim off common prefix (speedup).
      commonlength = this.diffCommonPrefix(text1, text2)
      commonprefix = text1.substring(0, commonlength)
      text1 = text1.substring(commonlength)
      text2 = text2.substring(commonlength)

      // Trim off common suffix (speedup).
      commonlength = this.diffCommonSuffix(text1, text2)
      commonsuffix = text1.substring(text1.length - commonlength)
      text1 = text1.substring(0, text1.length - commonlength)
      text2 = text2.substring(0, text2.length - commonlength)

      // Compute the diff on the middle block.
      diffs = this.diffCompute(text1, text2, checklines, deadline)

      // Restore the prefix and suffix.
      if (commonprefix) {
        diffs.unshift([DIFF_EQUAL, commonprefix])
      }
      if (commonsuffix) {
        diffs.push([DIFF_EQUAL, commonsuffix])
      }
      this.diffCleanupMerge(diffs)
      return diffs
    }

    /**
         * Reduce the number of edits by eliminating operationally trivial equalities.
         * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
         */
    DiffMatchPatch.prototype.diffCleanupEfficiency = function(diffs) {
      var changes, equalities, equalitiesLength, lastequality, pointer, preIns, preDel, postIns, postDel
      changes = false
      equalities = [] // Stack of indices where equalities are found.
      equalitiesLength = 0 // Keeping our own length var is faster in JS.
      /** @type {?string} */
      lastequality = null

      // Always equal to diffs[equalities[equalitiesLength - 1]][1]
      pointer = 0 // Index of current position.

      // Is there an insertion operation before the last equality.
      preIns = false

      // Is there a deletion operation before the last equality.
      preDel = false

      // Is there an insertion operation after the last equality.
      postIns = false

      // Is there a deletion operation after the last equality.
      postDel = false
      while (pointer < diffs.length) {

        // Equality found.
        if (diffs[pointer][0] === DIFF_EQUAL) {
          if (diffs[pointer][1].length < 4 && (postIns || postDel)) {

            // Candidate found.
            equalities[equalitiesLength++] = pointer
            preIns = postIns
            preDel = postDel
            lastequality = diffs[pointer][1]
          } else {

            // Not a candidate, and can never become one.
            equalitiesLength = 0
            lastequality = null
          }
          postIns = postDel = false

          // An insertion or deletion.
        } else {

          if (diffs[pointer][0] === DIFF_DELETE) {
            postDel = true
          } else {
            postIns = true
          }

          /*
       * Five types to be split:
       * <ins>A</ins><del>B</del>XY<ins>C</ins><del>D</del>
       * <ins>A</ins>X<ins>C</ins><del>D</del>
       * <ins>A</ins><del>B</del>X<ins>C</ins>
       * <ins>A</del>X<ins>C</ins><del>D</del>
       * <ins>A</ins><del>B</del>X<del>C</del>
       */
          if (lastequality && (preIns && preDel && postIns && postDel || lastequality.length < 2 && preIns + preDel + postIns + postDel === 3)) {

            // Duplicate record.
            diffs.splice(equalities[equalitiesLength - 1], 0, [DIFF_DELETE, lastequality])

            // Change second copy to insert.
            diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT
            equalitiesLength-- // Throw away the equality we just deleted;
            lastequality = null
            if (preIns && preDel) {

              // No changes made which could affect previous entry, keep going.
              postIns = postDel = true
              equalitiesLength = 0
            } else {
              equalitiesLength-- // Throw away the previous equality.
              pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1
              postIns = postDel = false
            }
            changes = true
          }
        }
        pointer++
      }

      if (changes) {
        this.diffCleanupMerge(diffs)
      }
    }

    /**
         * Convert a diff array into a pretty HTML report.
         * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
         * @param {integer} string to be beautified.
         * @return {string} HTML representation.
         */
    DiffMatchPatch.prototype.diffPrettyHtml = function(diffs) {
      var op,
          data,
          x,
          html = []
      for (x = 0; x < diffs.length; x++) {
        op = diffs[x][0] // Operation (insert, delete, equal)
        data = diffs[x][1] // Text of change.
        switch (op) {
          case DIFF_INSERT:
            html[x] = '<ins>' + escapeText(data) + '</ins>'
            break
          case DIFF_DELETE:
            html[x] = '<del>' + escapeText(data) + '</del>'
            break
          case DIFF_EQUAL:
            html[x] = '<span>' + escapeText(data) + '</span>'
            break
        }
      }
      return html.join('')
    }

    /**
         * Determine the common prefix of two strings.
         * @param {string} text1 First string.
         * @param {string} text2 Second string.
         * @return {number} The number of characters common to the start of each
         *     string.
         */
    DiffMatchPatch.prototype.diffCommonPrefix = function(text1, text2) {
      var pointermid, pointermax, pointermin, pointerstart

      // Quick check for common null cases.
      if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) {
        return 0
      }

      // Binary search.
      // Performance analysis: https://neil.fraser.name/news/2007/10/09/
      pointermin = 0
      pointermax = Math.min(text1.length, text2.length)
      pointermid = pointermax
      pointerstart = 0
      while (pointermin < pointermid) {
        if (text1.substring(pointerstart, pointermid) === text2.substring(pointerstart, pointermid)) {
          pointermin = pointermid
          pointerstart = pointermin
        } else {
          pointermax = pointermid
        }
        pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin)
      }
      return pointermid
    }

    /**
         * Determine the common suffix of two strings.
         * @param {string} text1 First string.
         * @param {string} text2 Second string.
         * @return {number} The number of characters common to the end of each string.
         */
    DiffMatchPatch.prototype.diffCommonSuffix = function(text1, text2) {
      var pointermid, pointermax, pointermin, pointerend

      // Quick check for common null cases.
      if (!text1 || !text2 || text1.charAt(text1.length - 1) !== text2.charAt(text2.length - 1)) {
        return 0
      }

      // Binary search.
      // Performance analysis: https://neil.fraser.name/news/2007/10/09/
      pointermin = 0
      pointermax = Math.min(text1.length, text2.length)
      pointermid = pointermax
      pointerend = 0
      while (pointermin < pointermid) {
        if (text1.substring(text1.length - pointermid, text1.length - pointerend) === text2.substring(text2.length - pointermid, text2.length - pointerend)) {
          pointermin = pointermid
          pointerend = pointermin
        } else {
          pointermax = pointermid
        }
        pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin)
      }
      return pointermid
    }

    /**
         * Find the differences between two texts.  Assumes that the texts do not
         * have any common prefix or suffix.
         * @param {string} text1 Old string to be diffed.
         * @param {string} text2 New string to be diffed.
         * @param {boolean} checklines Speedup flag.  If false, then don't run a
         *     line-level diff first to identify the changed areas.
         *     If true, then run a faster, slightly less optimal diff.
         * @param {number} deadline Time when the diff should be complete by.
         * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
         * @private
         */
    DiffMatchPatch.prototype.diffCompute = function(text1, text2, checklines, deadline) {
      var diffs, longtext, shorttext, i, hm, text1A, text2A, text1B, text2B, midCommon, diffsA, diffsB

      if (!text1) {

        // Just add some text (speedup).
        return [[DIFF_INSERT, text2]]
      }

      if (!text2) {

        // Just delete some text (speedup).
        return [[DIFF_DELETE, text1]]
      }

      longtext = text1.length > text2.length ? text1 : text2
      shorttext = text1.length > text2.length ? text2 : text1
      i = longtext.indexOf(shorttext)
      if (i !== -1) {

        // Shorter text is inside the longer text (speedup).
        diffs = [[DIFF_INSERT, longtext.substring(0, i)], [DIFF_EQUAL, shorttext], [DIFF_INSERT, longtext.substring(i + shorttext.length)]]

        // Swap insertions for deletions if diff is reversed.
        if (text1.length > text2.length) {
          diffs[0][0] = diffs[2][0] = DIFF_DELETE
        }
        return diffs
      }

      if (shorttext.length === 1) {

        // Single character string.
        // After the previous speedup, the character can't be an equality.
        return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]]
      }

      // Check to see if the problem can be split in two.
      hm = this.diffHalfMatch(text1, text2)
      if (hm) {

        // A half-match was found, sort out the return data.
        text1A = hm[0]
        text1B = hm[1]
        text2A = hm[2]
        text2B = hm[3]
        midCommon = hm[4]

        // Send both pairs off for separate processing.
        diffsA = this.DiffMain(text1A, text2A, checklines, deadline)
        diffsB = this.DiffMain(text1B, text2B, checklines, deadline)

        // Merge the results.
        return diffsA.concat([[DIFF_EQUAL, midCommon]], diffsB)
      }

      if (checklines && text1.length > 100 && text2.length > 100) {
        return this.diffLineMode(text1, text2, deadline)
      }

      return this.diffBisect(text1, text2, deadline)
    }

    /**
         * Do the two texts share a substring which is at least half the length of the
         * longer text?
         * This speedup can produce non-minimal diffs.
         * @param {string} text1 First string.
         * @param {string} text2 Second string.
         * @return {Array.<string>} Five element Array, containing the prefix of
         *     text1, the suffix of text1, the prefix of text2, the suffix of
         *     text2 and the common middle.  Or null if there was no match.
         * @private
         */
    DiffMatchPatch.prototype.diffHalfMatch = function(text1, text2) {
      var longtext, shorttext, dmp, text1A, text2B, text2A, text1B, midCommon, hm1, hm2, hm

      longtext = text1.length > text2.length ? text1 : text2
      shorttext = text1.length > text2.length ? text2 : text1
      if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
        return null // Pointless.
      }
      dmp = this // 'this' becomes 'window' in a closure.

      /**
             * Does a substring of shorttext exist within longtext such that the substring
             * is at least half the length of longtext?
             * Closure, but does not reference any external variables.
             * @param {string} longtext Longer string.
             * @param {string} shorttext Shorter string.
             * @param {number} i Start index of quarter length substring within longtext.
             * @return {Array.<string>} Five element Array, containing the prefix of
             *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
             *     of shorttext and the common middle.  Or null if there was no match.
             * @private
             */
      function diffHalfMatchI(longtext, shorttext, i) {
        var seed, j, bestCommon, prefixLength, suffixLength, bestLongtextA, bestLongtextB, bestShorttextA, bestShorttextB

        // Start with a 1/4 length substring at position i as a seed.
        seed = longtext.substring(i, i + Math.floor(longtext.length / 4))
        j = -1
        bestCommon = ''
        while ((j = shorttext.indexOf(seed, j + 1)) !== -1) {
          prefixLength = dmp.diffCommonPrefix(longtext.substring(i), shorttext.substring(j))
          suffixLength = dmp.diffCommonSuffix(longtext.substring(0, i), shorttext.substring(0, j))
          if (bestCommon.length < suffixLength + prefixLength) {
            bestCommon = shorttext.substring(j - suffixLength, j) + shorttext.substring(j, j + prefixLength)
            bestLongtextA = longtext.substring(0, i - suffixLength)
            bestLongtextB = longtext.substring(i + prefixLength)
            bestShorttextA = shorttext.substring(0, j - suffixLength)
            bestShorttextB = shorttext.substring(j + prefixLength)
          }
        }
        if (bestCommon.length * 2 >= longtext.length) {
          return [bestLongtextA, bestLongtextB, bestShorttextA, bestShorttextB, bestCommon]
        } else {
          return null
        }
      }

      // First check if the second quarter is the seed for a half-match.
      hm1 = diffHalfMatchI(longtext, shorttext, Math.ceil(longtext.length / 4))

      // Check again based on the third quarter.
      hm2 = diffHalfMatchI(longtext, shorttext, Math.ceil(longtext.length / 2))
      if (!hm1 && !hm2) {
        return null
      } else if (!hm2) {
        hm = hm1
      } else if (!hm1) {
        hm = hm2
      } else {

        // Both matched.  Select the longest.
        hm = hm1[4].length > hm2[4].length ? hm1 : hm2
      }

      // A half-match was found, sort out the return data.
      if (text1.length > text2.length) {
        text1A = hm[0]
        text1B = hm[1]
        text2A = hm[2]
        text2B = hm[3]
      } else {
        text2A = hm[0]
        text2B = hm[1]
        text1A = hm[2]
        text1B = hm[3]
      }
      midCommon = hm[4]
      return [text1A, text1B, text2A, text2B, midCommon]
    }

    /**
         * Do a quick line-level diff on both strings, then rediff the parts for
         * greater accuracy.
         * This speedup can produce non-minimal diffs.
         * @param {string} text1 Old string to be diffed.
         * @param {string} text2 New string to be diffed.
         * @param {number} deadline Time when the diff should be complete by.
         * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
         * @private
         */
    DiffMatchPatch.prototype.diffLineMode = function(text1, text2, deadline) {
      var a, diffs, linearray, pointer, countInsert, countDelete, textInsert, textDelete, j

      // Scan the text on a line-by-line basis first.
      a = this.diffLinesToChars(text1, text2)
      text1 = a.chars1
      text2 = a.chars2
      linearray = a.lineArray

      diffs = this.DiffMain(text1, text2, false, deadline)

      // Convert the diff back to original text.
      this.diffCharsToLines(diffs, linearray)

      // Eliminate freak matches (e.g. blank lines)
      this.diffCleanupSemantic(diffs)

      // Rediff any replacement blocks, this time character-by-character.
      // Add a dummy entry at the end.
      diffs.push([DIFF_EQUAL, ''])
      pointer = 0
      countDelete = 0
      countInsert = 0
      textDelete = ''
      textInsert = ''
      while (pointer < diffs.length) {
        switch (diffs[pointer][0]) {
          case DIFF_INSERT:
            countInsert++
            textInsert += diffs[pointer][1]
            break
          case DIFF_DELETE:
            countDelete++
            textDelete += diffs[pointer][1]
            break
          case DIFF_EQUAL:

            // Upon reaching an equality, check for prior redundancies.
            if (countDelete >= 1 && countInsert >= 1) {

              // Delete the offending records and add the merged ones.
              diffs.splice(pointer - countDelete - countInsert, countDelete + countInsert)
              pointer = pointer - countDelete - countInsert
              a = this.DiffMain(textDelete, textInsert, false, deadline)
              for (j = a.length - 1; j >= 0; j--) {
                diffs.splice(pointer, 0, a[j])
              }
              pointer = pointer + a.length
            }
            countInsert = 0
            countDelete = 0
            textDelete = ''
            textInsert = ''
            break
        }
        pointer++
      }
      diffs.pop() // Remove the dummy entry at the end.

      return diffs
    }

    /**
         * Find the 'middle snake' of a diff, split the problem in two
         * and return the recursively constructed diff.
         * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
         * @param {string} text1 Old string to be diffed.
         * @param {string} text2 New string to be diffed.
         * @param {number} deadline Time at which to bail if not yet complete.
         * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
         * @private
         */
    DiffMatchPatch.prototype.diffBisect = function(text1, text2, deadline) {
      var text1Length, text2Length, maxD, vOffset, vLength, v1, v2, x, delta, front, k1start, k1end, k2start, k2end, k2Offset, k1Offset, x1, x2, y1, y2, d, k1, k2

      // Cache the text lengths to prevent multiple calls.
      text1Length = text1.length
      text2Length = text2.length
      maxD = Math.ceil((text1Length + text2Length) / 2)
      vOffset = maxD
      vLength = 2 * maxD
      v1 = new Array(vLength)
      v2 = new Array(vLength)

      // Setting all elements to -1 is faster in Chrome & Firefox than mixing
      // integers and undefined.
      for (x = 0; x < vLength; x++) {
        v1[x] = -1
        v2[x] = -1
      }
      v1[vOffset + 1] = 0
      v2[vOffset + 1] = 0
      delta = text1Length - text2Length

      // If the total number of characters is odd, then the front path will collide
      // with the reverse path.
      front = delta % 2 !== 0

      // Offsets for start and end of k loop.
      // Prevents mapping of space beyond the grid.
      k1start = 0
      k1end = 0
      k2start = 0
      k2end = 0
      for (d = 0; d < maxD; d++) {

        // Bail out if deadline is reached.
        if (new Date().getTime() > deadline) {
          break
        }

        // Walk the front path one step.
        for (k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
          k1Offset = vOffset + k1
          if (k1 === -d || k1 !== d && v1[k1Offset - 1] < v1[k1Offset + 1]) {
            x1 = v1[k1Offset + 1]
          } else {
            x1 = v1[k1Offset - 1] + 1
          }
          y1 = x1 - k1
          while (x1 < text1Length && y1 < text2Length && text1.charAt(x1) === text2.charAt(y1)) {
            x1++
            y1++
          }
          v1[k1Offset] = x1
          if (x1 > text1Length) {

            // Ran off the right of the graph.
            k1end += 2
          } else if (y1 > text2Length) {

            // Ran off the bottom of the graph.
            k1start += 2
          } else if (front) {
            k2Offset = vOffset + delta - k1
            if (k2Offset >= 0 && k2Offset < vLength && v2[k2Offset] !== -1) {

              // Mirror x2 onto top-left coordinate system.
              x2 = text1Length - v2[k2Offset]
              if (x1 >= x2) {

                // Overlap detected.
                return this.diffBisectSplit(text1, text2, x1, y1, deadline)
              }
            }
          }
        }

        // Walk the reverse path one step.
        for (k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
          k2Offset = vOffset + k2
          if (k2 === -d || k2 !== d && v2[k2Offset - 1] < v2[k2Offset + 1]) {
            x2 = v2[k2Offset + 1]
          } else {
            x2 = v2[k2Offset - 1] + 1
          }
          y2 = x2 - k2
          while (x2 < text1Length && y2 < text2Length && text1.charAt(text1Length - x2 - 1) === text2.charAt(text2Length - y2 - 1)) {
            x2++
            y2++
          }
          v2[k2Offset] = x2
          if (x2 > text1Length) {

            // Ran off the left of the graph.
            k2end += 2
          } else if (y2 > text2Length) {

            // Ran off the top of the graph.
            k2start += 2
          } else if (!front) {
            k1Offset = vOffset + delta - k2
            if (k1Offset >= 0 && k1Offset < vLength && v1[k1Offset] !== -1) {
              x1 = v1[k1Offset]
              y1 = vOffset + x1 - k1Offset

              // Mirror x2 onto top-left coordinate system.
              x2 = text1Length - x2
              if (x1 >= x2) {

                // Overlap detected.
                return this.diffBisectSplit(text1, text2, x1, y1, deadline)
              }
            }
          }
        }
      }

      // Diff took too long and hit the deadline or
      // number of diffs equals number of characters, no commonality at all.
      return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]]
    }

    /**
         * Given the location of the 'middle snake', split the diff in two parts
         * and recurse.
         * @param {string} text1 Old string to be diffed.
         * @param {string} text2 New string to be diffed.
         * @param {number} x Index of split point in text1.
         * @param {number} y Index of split point in text2.
         * @param {number} deadline Time at which to bail if not yet complete.
         * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
         * @private
         */
    DiffMatchPatch.prototype.diffBisectSplit = function(text1, text2, x, y, deadline) {
      var text1a, text1b, text2a, text2b, diffs, diffsb
      text1a = text1.substring(0, x)
      text2a = text2.substring(0, y)
      text1b = text1.substring(x)
      text2b = text2.substring(y)

      // Compute both diffs serially.
      diffs = this.DiffMain(text1a, text2a, false, deadline)
      diffsb = this.DiffMain(text1b, text2b, false, deadline)

      return diffs.concat(diffsb)
    }

    /**
         * Reduce the number of edits by eliminating semantically trivial equalities.
         * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
         */
    DiffMatchPatch.prototype.diffCleanupSemantic = function(diffs) {
      var changes, equalities, equalitiesLength, lastequality, pointer, lengthInsertions2, lengthDeletions2, lengthInsertions1, lengthDeletions1, deletion, insertion, overlapLength1, overlapLength2
      changes = false
      equalities = [] // Stack of indices where equalities are found.
      equalitiesLength = 0 // Keeping our own length var is faster in JS.
      /** @type {?string} */
      lastequality = null

      // Always equal to diffs[equalities[equalitiesLength - 1]][1]
      pointer = 0 // Index of current position.

      // Number of characters that changed prior to the equality.
      lengthInsertions1 = 0
      lengthDeletions1 = 0

      // Number of characters that changed after the equality.
      lengthInsertions2 = 0
      lengthDeletions2 = 0
      while (pointer < diffs.length) {
        if (diffs[pointer][0] === DIFF_EQUAL) {
          // Equality found.
          equalities[equalitiesLength++] = pointer
          lengthInsertions1 = lengthInsertions2
          lengthDeletions1 = lengthDeletions2
          lengthInsertions2 = 0
          lengthDeletions2 = 0
          lastequality = diffs[pointer][1]
        } else {
          // An insertion or deletion.
          if (diffs[pointer][0] === DIFF_INSERT) {
            lengthInsertions2 += diffs[pointer][1].length
          } else {
            lengthDeletions2 += diffs[pointer][1].length
          }

          // Eliminate an equality that is smaller or equal to the edits on both
          // sides of it.
          if (lastequality && lastequality.length <= Math.max(lengthInsertions1, lengthDeletions1) && lastequality.length <= Math.max(lengthInsertions2, lengthDeletions2)) {

            // Duplicate record.
            diffs.splice(equalities[equalitiesLength - 1], 0, [DIFF_DELETE, lastequality])

            // Change second copy to insert.
            diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT

            // Throw away the equality we just deleted.
            equalitiesLength--

            // Throw away the previous equality (it needs to be reevaluated).
            equalitiesLength--
            pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1

            // Reset the counters.
            lengthInsertions1 = 0
            lengthDeletions1 = 0
            lengthInsertions2 = 0
            lengthDeletions2 = 0
            lastequality = null
            changes = true
          }
        }
        pointer++
      }

      // Normalize the diff.
      if (changes) {
        this.diffCleanupMerge(diffs)
      }

      // Find any overlaps between deletions and insertions.
      // e.g: <del>abcxxx</del><ins>xxxdef</ins>
      //   -> <del>abc</del>xxx<ins>def</ins>
      // e.g: <del>xxxabc</del><ins>defxxx</ins>
      //   -> <ins>def</ins>xxx<del>abc</del>
      // Only extract an overlap if it is as big as the edit ahead or behind it.
      pointer = 1
      while (pointer < diffs.length) {
        if (diffs[pointer - 1][0] === DIFF_DELETE && diffs[pointer][0] === DIFF_INSERT) {
          deletion = diffs[pointer - 1][1]
          insertion = diffs[pointer][1]
          overlapLength1 = this.diffCommonOverlap(deletion, insertion)
          overlapLength2 = this.diffCommonOverlap(insertion, deletion)
          if (overlapLength1 >= overlapLength2) {
            if (overlapLength1 >= deletion.length / 2 || overlapLength1 >= insertion.length / 2) {

              // Overlap found.  Insert an equality and trim the surrounding edits.
              diffs.splice(pointer, 0, [DIFF_EQUAL, insertion.substring(0, overlapLength1)])
              diffs[pointer - 1][1] = deletion.substring(0, deletion.length - overlapLength1)
              diffs[pointer + 1][1] = insertion.substring(overlapLength1)
              pointer++
            }
          } else {
            if (overlapLength2 >= deletion.length / 2 || overlapLength2 >= insertion.length / 2) {

              // Reverse overlap found.
              // Insert an equality and swap and trim the surrounding edits.
              diffs.splice(pointer, 0, [DIFF_EQUAL, deletion.substring(0, overlapLength2)])

              diffs[pointer - 1][0] = DIFF_INSERT
              diffs[pointer - 1][1] = insertion.substring(0, insertion.length - overlapLength2)
              diffs[pointer + 1][0] = DIFF_DELETE
              diffs[pointer + 1][1] = deletion.substring(overlapLength2)
              pointer++
            }
          }
          pointer++
        }
        pointer++
      }
    }

    /**
         * Determine if the suffix of one string is the prefix of another.
         * @param {string} text1 First string.
         * @param {string} text2 Second string.
         * @return {number} The number of characters common to the end of the first
         *     string and the start of the second string.
         * @private
         */
    DiffMatchPatch.prototype.diffCommonOverlap = function(text1, text2) {
      var text1Length, text2Length, textLength, best, length, pattern, found

      // Cache the text lengths to prevent multiple calls.
      text1Length = text1.length
      text2Length = text2.length

      // Eliminate the null case.
      if (text1Length === 0 || text2Length === 0) {
        return 0
      }

      // Truncate the longer string.
      if (text1Length > text2Length) {
        text1 = text1.substring(text1Length - text2Length)
      } else if (text1Length < text2Length) {
        text2 = text2.substring(0, text1Length)
      }
      textLength = Math.min(text1Length, text2Length)

      // Quick check for the worst case.
      if (text1 === text2) {
        return textLength
      }

      // Start by looking for a single character match
      // and increase length until no match is found.
      // Performance analysis: https://neil.fraser.name/news/2010/11/04/
      best = 0
      length = 1
      while (true) {
        pattern = text1.substring(textLength - length)
        found = text2.indexOf(pattern)
        if (found === -1) {
          return best
        }
        length += found
        if (found === 0 || text1.substring(textLength - length) === text2.substring(0, length)) {
          best = length
          length++
        }
      }
    }

    /**
         * Split two texts into an array of strings.  Reduce the texts to a string of
         * hashes where each Unicode character represents one line.
         * @param {string} text1 First string.
         * @param {string} text2 Second string.
         * @return {{chars1: string, chars2: string, lineArray: !Array.<string>}}
         *     An object containing the encoded text1, the encoded text2 and
         *     the array of unique strings.
         *     The zeroth element of the array of unique strings is intentionally blank.
         * @private
         */
    DiffMatchPatch.prototype.diffLinesToChars = function(text1, text2) {
      var lineArray, lineHash, chars1, chars2
      lineArray = [] // E.g. lineArray[4] === 'Hello\n'
      lineHash = {} // E.g. lineHash['Hello\n'] === 4

      // '\x00' is a valid character, but various debuggers don't like it.
      // So we'll insert a junk entry to avoid generating a null character.
      lineArray[0] = ''

      /**
             * Split a text into an array of strings.  Reduce the texts to a string of
             * hashes where each Unicode character represents one line.
             * Modifies linearray and linehash through being a closure.
             * @param {string} text String to encode.
             * @return {string} Encoded string.
             * @private
             */
      function diffLinesToCharsMunge(text) {
        var chars, lineStart, lineEnd, lineArrayLength, line
        chars = ''

        // Walk the text, pulling out a substring for each line.
        // text.split('\n') would would temporarily double our memory footprint.
        // Modifying text would create many large strings to garbage collect.
        lineStart = 0
        lineEnd = -1

        // Keeping our own length variable is faster than looking it up.
        lineArrayLength = lineArray.length
        while (lineEnd < text.length - 1) {
          lineEnd = text.indexOf('\n', lineStart)
          if (lineEnd === -1) {
            lineEnd = text.length - 1
          }
          line = text.substring(lineStart, lineEnd + 1)
          lineStart = lineEnd + 1

          if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) : lineHash[line] !== undefined) {
            chars += String.fromCharCode(lineHash[line])
          } else {
            chars += String.fromCharCode(lineArrayLength)
            lineHash[line] = lineArrayLength
            lineArray[lineArrayLength++] = line
          }
        }
        return chars
      }

      chars1 = diffLinesToCharsMunge(text1)
      chars2 = diffLinesToCharsMunge(text2)
      return {
        chars1: chars1,
        chars2: chars2,
        lineArray: lineArray
      }
    }

    /**
         * Rehydrate the text in a diff from a string of line hashes to real lines of
         * text.
         * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
         * @param {!Array.<string>} lineArray Array of unique strings.
         * @private
         */
    DiffMatchPatch.prototype.diffCharsToLines = function(diffs, lineArray) {
      var x, chars, text, y
      for (x = 0; x < diffs.length; x++) {
        chars = diffs[x][1]
        text = []
        for (y = 0; y < chars.length; y++) {
          text[y] = lineArray[chars.charCodeAt(y)]
        }
        diffs[x][1] = text.join('')
      }
    }

    /**
         * Reorder and merge like edit sections.  Merge equalities.
         * Any edit section can move as long as it doesn't cross an equality.
         * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
         */
    DiffMatchPatch.prototype.diffCleanupMerge = function(diffs) {
      var pointer, countDelete, countInsert, textInsert, textDelete, commonlength, changes, diffPointer, position
      diffs.push([DIFF_EQUAL, '']) // Add a dummy entry at the end.
      pointer = 0
      countDelete = 0
      countInsert = 0
      textDelete = ''
      textInsert = ''

      while (pointer < diffs.length) {
        switch (diffs[pointer][0]) {
          case DIFF_INSERT:
            countInsert++
            textInsert += diffs[pointer][1]
            pointer++
            break
          case DIFF_DELETE:
            countDelete++
            textDelete += diffs[pointer][1]
            pointer++
            break
          case DIFF_EQUAL:

            // Upon reaching an equality, check for prior redundancies.
            if (countDelete + countInsert > 1) {
              if (countDelete !== 0 && countInsert !== 0) {

                // Factor out any common prefixes.
                commonlength = this.diffCommonPrefix(textInsert, textDelete)
                if (commonlength !== 0) {
                  if (pointer - countDelete - countInsert > 0 && diffs[pointer - countDelete - countInsert - 1][0] === DIFF_EQUAL) {
                    diffs[pointer - countDelete - countInsert - 1][1] += textInsert.substring(0, commonlength)
                  } else {
                    diffs.splice(0, 0, [DIFF_EQUAL, textInsert.substring(0, commonlength)])
                    pointer++
                  }
                  textInsert = textInsert.substring(commonlength)
                  textDelete = textDelete.substring(commonlength)
                }

                // Factor out any common suffixies.
                commonlength = this.diffCommonSuffix(textInsert, textDelete)
                if (commonlength !== 0) {
                  diffs[pointer][1] = textInsert.substring(textInsert.length - commonlength) + diffs[pointer][1]
                  textInsert = textInsert.substring(0, textInsert.length - commonlength)
                  textDelete = textDelete.substring(0, textDelete.length - commonlength)
                }
              }

              // Delete the offending records and add the merged ones.
              if (countDelete === 0) {
                diffs.splice(pointer - countInsert, countDelete + countInsert, [DIFF_INSERT, textInsert])
              } else if (countInsert === 0) {
                diffs.splice(pointer - countDelete, countDelete + countInsert, [DIFF_DELETE, textDelete])
              } else {
                diffs.splice(pointer - countDelete - countInsert, countDelete + countInsert, [DIFF_DELETE, textDelete], [DIFF_INSERT, textInsert])
              }
              pointer = pointer - countDelete - countInsert + (countDelete ? 1 : 0) + (countInsert ? 1 : 0) + 1
            } else if (pointer !== 0 && diffs[pointer - 1][0] === DIFF_EQUAL) {

              // Merge this equality with the previous one.
              diffs[pointer - 1][1] += diffs[pointer][1]
              diffs.splice(pointer, 1)
            } else {
              pointer++
            }
            countInsert = 0
            countDelete = 0
            textDelete = ''
            textInsert = ''
            break
        }
      }
      if (diffs[diffs.length - 1][1] === '') {
        diffs.pop() // Remove the dummy entry at the end.
      }

      // Second pass: look for single edits surrounded on both sides by equalities
      // which can be shifted sideways to eliminate an equality.
      // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
      changes = false
      pointer = 1

      // Intentionally ignore the first and last element (don't need checking).
      while (pointer < diffs.length - 1) {
        if (diffs[pointer - 1][0] === DIFF_EQUAL && diffs[pointer + 1][0] === DIFF_EQUAL) {

          diffPointer = diffs[pointer][1]
          position = diffPointer.substring(diffPointer.length - diffs[pointer - 1][1].length)

          // This is a single edit surrounded by equalities.
          if (position === diffs[pointer - 1][1]) {

            // Shift the edit over the previous equality.
            diffs[pointer][1] = diffs[pointer - 1][1] + diffs[pointer][1].substring(0, diffs[pointer][1].length - diffs[pointer - 1][1].length)
            diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1]
            diffs.splice(pointer - 1, 1)
            changes = true
          } else if (diffPointer.substring(0, diffs[pointer + 1][1].length) === diffs[pointer + 1][1]) {

            // Shift the edit over the next equality.
            diffs[pointer - 1][1] += diffs[pointer + 1][1]
            diffs[pointer][1] = diffs[pointer][1].substring(diffs[pointer + 1][1].length) + diffs[pointer + 1][1]
            diffs.splice(pointer + 1, 1)
            changes = true
          }
        }
        pointer++
      }

      // If shifts were made, the diff needs reordering and another shift sweep.
      if (changes) {
        this.diffCleanupMerge(diffs)
      }
    }

    return function(o, n) {
      var diff, output, text
      diff = new DiffMatchPatch()
      output = diff.DiffMain(o, n)
      diff.diffCleanupEfficiency(output)
      text = diff.diffPrettyHtml(output)

      return text
    }
  }())

}(global))
