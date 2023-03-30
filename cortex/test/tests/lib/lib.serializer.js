'use strict'

/* eslint-disable node/no-deprecated-api, no-unused-vars */

const path = require('path'),
      utils = require('../../../lib/utils'),
      { bson: { ObjectID } } = utils,
      standaloneSandboxed = require('../../lib/sandboxed-standalone')

require('should')

function sandboxed(main) {

  const api = {
    debug: {
      echo: function(val, callback) {
        callback(null, val)
      }
    },
    console: {
      log: function(payload, callback) {
        console.log(...payload)
      }
    }
  }
  api.console.log.$is_var_args = true

  let fn = standaloneSandboxed(
    main,
    {
      jspath: path.resolve(path.join(__dirname, '../../../lib/modules/sandbox/scripts/build/modules')),
      transpile: true,
      enableDebugModule: true,
      api: api
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

function concatFns(...fns) {
  const source = fns.reduce((src, fn) => {
    const match = fn.toString().match(/^function[\s]{0,}([$A-Z_][0-9A-Z_$]*)?\(([^)]*)?\)[\s]{0,}{([\s\S]*)}$/i)
    return `${src}\n${match ? match[3] : ''}`
  }, '')
  return new Function(source) // eslint-disable-line no-new-func
}

function template(echo, deepEquals, serialize, deserialize, section) {

  const array = [
    '~',
    '~;',
    '~~~;',
    '3433~;;;1;2;!@:!~2;12:~!#;213!@:#',
    '^',
    '^;',
    'test^',
    'test^reer',
    'test^;',
    'test^reer',
    '^:%^:#$%:$%:@#$:@#$2;34;532;4324:@#4;2343;5;324#^;~~``~;`;:~:`~:::@:#13;@;12test^reer',
    'test^;reer',
    '^test^',
    '^test^;',
    '^test^reer',
    '^test^;reer',
    '^i' + new ObjectID(),
    '^b' + new Buffer('43243242'),
    '^d' + Date.toString(),
    { a: { b: '~' } },
    { a: { b: '~;' } },
    { a: { b: '~~~;' } },
    { a: { b: '3433~;;;1;2;!@:!~2;12:~!#;213!@:#' } },
    { a: { b: '^' } },
    { a: { b: '^;' } },
    { a: { b: 'test^' } },
    { a: { b: 'test^;' } },
    { a: { b: 'test^reer' } },
    { a: { b: 'test^;reer' } },
    { a: { b: '^test^' } },
    { a: { b: '^test^;' } },
    { a: { b: '^test^reer' } },
    { a: { b: '^test^;reer' } },
    { a: { b: '^i' + new ObjectID() } },
    { a: { b: '^b' + new Buffer('43243242') } },
    { a: { b: '^d' + Date.toString() } }
  ]
  array.forEach(testValue)

  splitPairs([

    new Buffer(''), Buffer,
    ({}), Object,
    new Date(), Date,
    /hootie hootie hoot/, RegExp,
    [], Array

  ]).forEach((pair, i) => testInstance(pair[0], pair[1], i));

  [
    new Buffer('1234'),
    new ObjectID(),
    new Date()

  ].forEach(testString)

  {
    const a = {},
          b = { stuff: '~not cool', thing2: 'plain', bWithA: a, '~funnyKey': 123 },
          c = [a, b]

    b.bWithB = b
    a.aWithB = b
    a.deep = { 'odd~name': a }
    c.push(c);

    [
      a,
      b,
      c,
      (() => {

        const a = {},
              b = { stuff: '~not cool', thing2: 'plain', bWithA: a, '~funnyKey': 123 },
              c = [a, b]

        b.bWithB = b
        a.aWithB = b
        b.deep = { 'odd~name': [1, 2, 3, { thing: c }] }
        c.push(c)
        a.d = new Buffer('123')
        a.e = new ObjectID()

        return a

      })()
    ].forEach(testSerialized)

  }

  // -------

  function testValue(x, i) {
    if (!deepEquals(echo(x), x)) {
      throw new Error(`${section}.testValue #${i + 1} failed. ${echo(x)} should equal ${x}`)
    }
  }

  function testString(x, i) {
    if (echo(x).toString('utf8') !== x.toString('utf8')) {
      throw new Error(`${section}.testString #${i + 1} failed. ${echo(x)} should equal ${x}`)
    }
  }

  function testInstance(x, cls, i) {
    if (!(echo(x) instanceof cls)) {
      throw new Error(`${section}.testInstance #${i + 1} failed. ${echo(x)} should be an instance of ${cls.name}`)
    }
    echo(x).should.be.instanceof(cls)
  }

  function splitPairs(arr) {
    const pairs = []
    for (let i = 0; i < arr.length; i += 2) {
      if (arr[i + 1] !== undefined) {
        pairs.push([arr[i], arr[i + 1]])
      } else {
        pairs.push([arr[i]])
      }
    }
    return pairs
  }

  function testSerialized(x, i) {
    if (serialize(deserialize(serialize(x, true), true), true) !== serialize(x, true)) {
      throw new Error(`${section}.testCircular #${i + 1} failed. ${echo(x)} should equal ${x}`)
    }

  }
}

describe('Lib', function() {

  describe('Serializer', function() {

    describe('Api serializer', function() {

      it('circular', function() {

        const echo = function(v) {
          return utils.deserializeObject(utils.serializeObject(v, true), true)
        }
        template(echo, utils.deepEquals, utils.serializeObject, utils.deserializeObject, 'api circular')

      })

      it('non-circular', function() {

        const echo = function(v) {
          return utils.deserializeObject(utils.serializeObject(v))
        }
        template(echo, utils.deepEquals, utils.serializeObject, utils.deserializeObject, 'api non-circular')

      })

    })

    describe('Sandbox MJSON', function() {

      it('Sandbox MJSON', sandboxed(concatFns(function() {

        const object = {},
              dupeArray = [
                object,
                object
              ],
              dupeObject = {
                object,
                dupe: object
              },
              circular = { name: 'foo', children: [{ name: 'bar' }, { name: 'baz' }] }

        circular.children[0].self = circular.children[0]
        circular.children[0].sib = circular.children[1]
        circular.children[1].self = circular.children[1]
        circular.children[1].sib = circular.children[0]

        const should = require('should'),
              { stringify, parse } = require('util.json'),

              objectString = stringify(dupeObject, 'mjson', { hydration: true }),
              arrayString = stringify(dupeArray, 'mjson', { hydration: true }),
              circularString = stringify(circular, 'mjson', { hydration: true }),
              parsedObject = parse(objectString, 'mjson', { hydration: true }),
              parsedArray = parse(arrayString, 'mjson', { hydration: true }),
              parsedCircular = parse(circularString, 'mjson', { hydration: true })

        should.equal(
          objectString,
          '{"object":{},"dupe":"~object"}'
        )
        should.equal(
          parsedObject.object,
          parsedObject.dupe
        )
        should.equal(
          arrayString,
          '[{},"~0"]'
        )
        should.equal(
          parsedArray[0],
          parsedArray[1]
        )
        should.equal(
          circularString,
          '{"name":"foo","children":[{"name":"bar","self":"~children~0","sib":{"name":"baz","self":"~children~0~sib","sib":"~children~0"}},"~children~0~sib"]}'
        )
        should.equal(
          parsedCircular.children[0],
          parsedCircular.children[1].sib,
          parsedCircular.children[0].self
        )

      })))

    })

    describe('Sandbox serializer', function() {

      it('non-circular', sandboxed(concatFns(function() {

        require('should')

        const echo = require('debug').echo,
              deepEquals = require('util.deep-equals'),
              section = 'sandbox non-circular',
              serialize = require('util.json').serialize,
              deserialize = require('util.json').deserialize,
              console = require('console')

      }, template)))

      it('native circular', sandboxed(concatFns(function() {

        require('should')

        const serialize = require('util.json').serialize,
              deserialize = require('util.json').deserialize,
              echo = function(v) {
                return deserialize(serialize(v, true), true)
              },
              deepEquals = require('util.deep-equals'),
              section = 'sandbox native circular',
              console = require('console')

      }, template)))

      it('native non-circular', sandboxed(concatFns(function() {

        require('should')

        const serialize = require('util.json').serialize,
              deserialize = require('util.json').deserialize,
              echo = function(v) {
                return deserialize(serialize(v))
              },
              deepEquals = require('util.deep-equals'),
              section = 'sandbox native non-circular',
              console = require('console')

      }, template)))

    })

  })

})
