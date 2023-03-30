const path = require('path'),
      server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should'),
      utils = require('../../../../lib/utils'),
      { ObjectID } = require('cortex-service/lib/utils/ids'),
      sandboxed = require('../../../lib/sandboxed'),
      standaloneSandboxed = require('../../../lib/sandboxed-standalone')

function serializerSandboxed(main) {

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
      jspath: path.resolve(path.join(__dirname, '../../../../lib/modules/sandbox/scripts/build/modules')),
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


describe('CTXAPI-1236 - bson security npm audit', function() {

  it('Operator$equals', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          oId = new ObjectID(),
          result = await Promise.all([
            expressions.createContext(ac, { $equals: { input: ['a', 'a'], cast: false } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [2, 'a'], cast: false } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [{ $toObjectId: '5f6d041f0000000000000000' }, { $toObjectId: '5f6d041f0000000000000000' }], cast: false } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [true, 1], cast: true } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: ['1', 1], cast: false, strict: true } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [oId, oId], cast: false, strict: true } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [oId, new ObjectID()], cast: false, strict: true } }).evaluate()
          ])

    should(result).deepEqual([true, false, true, true, false, true, false])

  })

  it('Operator$type ObjectId', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $type: new ObjectID('5f6d041f0000000000000000')
            }
          ),
          result = await ec.evaluate()

    should(result).equal('ObjectId')
  })

  it('Operator$type - scripting ', sandboxed(function() {

    const should = require('should'),
          { ObjectID } = global,
          { run } = require('expressions'),
          result = run({
            $object: {
              Array: { $type: { $literal: [] } },
              Binary: { $type: { $literal: new Buffer('1') } }, // eslint-disable-line node/no-deprecated-api
              Date: { $type: new Date() },
              Null: { $type: null },
              Number: { $type: 1 },
              Object: { $type: { $literal: {} } },
              ObjectId: { $type: new ObjectID() },
              RegExp: { $type: /foo/ },
              String: { $type: 'foo' }
            }
          })

    for (const [key, value] of Object.entries(result)) {
      should(key).equal(value)
    }

  }))

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

      describe('Sandbox serializer', function() {

        it('non-circular', serializerSandboxed(concatFns(function() {

          require('should')

          const echo = require('debug').echo,
                deepEquals = require('util.deep-equals'),
                section = 'sandbox non-circular',
                serialize = require('util.json').serialize,
                deserialize = require('util.json').deserialize,
                console = require('console')

        }, template)))

        it('native circular', serializerSandboxed(concatFns(function() {

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

        it('native non-circular', serializerSandboxed(concatFns(function() {

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

})
