'use strict'

const { promised } = require('../../../lib/utils'),
      should = require('should'),
      modules = require('../../../lib/modules')

describe('Features - AST transpiler', function() {

  const source = `
          const { transform, each } = require('decorators-transform')
          @transform({useDecorators: true})
          class Transform {
              @each
              each(a, b, c) {
                  return 2
              }
          }
          module.exports = Transform
          // Frodo Baggins
          `

  beforeEach(function() {
    modules.cache.memory.get('service.transpiler.scripts').flush()
  })

  it('should fail to transpile es6 code with specification = es5', async() => {
    let result, error

    try {
      result = await promised(modules.services.transpiler, 'transpile',
        source,
        {
          specification: 'es5'
        }
      )
    } catch (e) {
      error = e
    }

    should.not.exist(result)
    should.exist(error)
    should.equal(error.errCode, 'cortex.invalidArgument.scriptCompilation')
    should.equal(error.code, 'kScriptCompilationError')
    should.equal(error.statusCode, 400)
    should.equal(error.name, 'validation')
    should.equal(error.reason, 'There is an error in your script.')

    should.equal(error.faults.length, 1)
    should.equal(error.faults[0].message.includes('Script: Unexpected token (3:10) (line: 3, col: 10)'), true)

  })

  it('should transpile and not retain lines when retainLines = false', async() => {
    let result, transpilerCache, cacheKey, cacheEntry

    result = await promised(modules.services.transpiler, 'transpile',
      source,
      {
        retainLines: false
      }
    )

    transpilerCache = modules.cache.memory.get('service.transpiler.scripts')

    should.not.exist(result.ast)
    result.source.split('\n').length.should.equal(57)

    verifyTranspilerResult(result)
    should.exist(transpilerCache)

    should.equal(transpilerCache.length, 1)
    should.equal(Object.keys(transpilerCache.indexes._id).length, 1)
    cacheKey = Object.keys(transpilerCache.indexes._id)[0]
    cacheEntry = transpilerCache.get(cacheKey)

    should.not.exist(cacheEntry.err)
    verifyTranspilerResult(cacheEntry.transpiled)
  })

  it('should not transpile when returning outside the function and allowReturnOutsideFunction = false', async() => {
    let transpilerResult, transpilerError

    try {
      transpilerResult = await promised(modules.services.transpiler, 'transpile',
        'return 42',
        {
          allowReturnOutsideFunction: false
        }
      )
    } catch (e) {
      transpilerError = e
    }

    should.not.exist(transpilerResult)
    should.exist(transpilerError)
    should.equal(transpilerError.errCode, 'cortex.invalidArgument.scriptCompilation')
    should.equal(transpilerError.code, 'kScriptCompilationError')
    should.equal(transpilerError.statusCode, 400)
    should.equal(transpilerError.name, 'validation')
    should.equal(transpilerError.reason, 'There is an error in your script.')

    should.equal(transpilerError.faults.length, 1)
    should.equal(transpilerError.faults[0].message.includes('Script: \'return\' outside of function (1:0) (line: 1, col: 0)'), true)
  })

  it('should transpile the source with comments when comments = true', async() => {
    let result, transpilerCache, cacheKey, cacheEntry

    result = await promised(modules.services.transpiler, 'transpile',
      source,
      {
        comments: true
      }
    )

    transpilerCache = modules.cache.memory.get('service.transpiler.scripts')

    should.not.exist(result.ast)
    result.source.includes('// Frodo Baggins').should.equal(true)

    verifyTranspilerResult(result)
    should.exist(transpilerCache)

    should.equal(transpilerCache.length, 1)
    should.equal(Object.keys(transpilerCache.indexes._id).length, 1)
    cacheKey = Object.keys(transpilerCache.indexes._id)[0]
    cacheEntry = transpilerCache.get(cacheKey)

    should.not.exist(cacheEntry.err)
    verifyTranspilerResult(cacheEntry.transpiled)
  })

  it('should transpile and not cache the AST when setting ast = true', async() => {
    let result, transpilerCache

    result = await promised(modules.services.transpiler, 'transpile',
      source,
      {
        ast: true
      }
    )

    transpilerCache = modules.cache.memory.get('service.transpiler.scripts')

    verifyTranspilerResult(result)
    should.exist(result.ast)
    result.source.split('\n').length.should.equal(10)
    should.exist(transpilerCache)

    should.equal(transpilerCache.length, 0)
    should.equal(Object.keys(transpilerCache.indexes._id).length, 0)
  })

  it('should transpile the source when called from services module', async() => {
    let result, transpilerCache, cacheKey, cacheEntry

    result = await promised(modules.services.transpiler, 'transpile',
      source
    )

    transpilerCache = modules.cache.memory.get('service.transpiler.scripts')

    should.not.exist(result.ast)
    result.source.includes('Frodo Baggins').should.equal(false)
    verifyTranspilerResult(result)
    should.exist(transpilerCache)

    should.equal(transpilerCache.length, 1)
    should.equal(Object.keys(transpilerCache.indexes._id).length, 1)
    cacheKey = Object.keys(transpilerCache.indexes._id)[0]
    cacheEntry = transpilerCache.get(cacheKey)

    should.not.exist(cacheEntry.err)
    verifyTranspilerResult(cacheEntry.transpiled)
  })

  function verifyTranspilerResult(result) {
    let clazz, decorator, method

    should.exist(result)
    should.equal(result.imports.length, 0)
    should.equal(result.classes.length, 1)

    clazz = result.classes[0]

    should.equal(clazz.name, 'Transform')
    should.equal(clazz.loc.line, 4)
    should.equal(clazz.loc.column, 10)

    should.equal(clazz.properties.length, 0)
    should.equal(clazz.decorators.length, 1)
    should.equal(clazz.methods.length, 1)

    decorator = clazz.decorators[0]

    should.equal(decorator.name, 'transform')
    should.equal(decorator.loc.line, 3)
    should.equal(decorator.loc.column, 10)
    should.equal(decorator.params[0].useDecorators, true)

    method = clazz.methods[0]

    should.equal(method.name, 'each')
    should.equal(method.static, false)
    should.equal(method.async, false)
    should.equal(method.kind, 'method')
    should.equal(method.loc.line, 6)
    should.equal(method.loc.column, 14)
    should.equal(method.decorators.length, 1)

    decorator = method.decorators[0]

    should.equal(decorator.name, 'each')
    should.equal(decorator.loc.line, 5)
    should.equal(decorator.loc.column, 14)
    should.equal(decorator.params.length, 0)
  }
})
