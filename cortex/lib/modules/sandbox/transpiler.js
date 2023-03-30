'use strict'

const Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      _ = require('underscore'),
      path = require('path'),
      bytes = require('bytes'),
      clone = require('clone'),
      { rBool, rString, array: toArray, resolveCallbackArguments, isSet } = require('cortex-service/lib/utils/values'),
      { path: pathTo } = require('cortex-service/lib/utils/paths'),
      { asyncWhile } = require('../../utils'),
      { version } = require('../../../package.json'),
      { createHash } = require('crypto'),
      es6PluginBasedir = path.join(__dirname, '/../../../node_modules'),
      es6BabelPlugins = [
        path.join(es6PluginBasedir, 'babel-plugin-check-es2015-constants'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-decorators-legacy'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-class-properties'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-regenerator'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-arrow-functions'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-block-scoped-functions'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-block-scoping'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-classes'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-computed-properties'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-duplicate-keys'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-function-name'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-literals'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-modules-commonjs'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-object-super'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-parameters'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-shorthand-properties'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-spread'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-template-literals'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-destructuring'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-for-of'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-es2015-typeof-symbol'),
        path.join(es6PluginBasedir, 'babel-plugin-transform-object-rest-spread')
      ],
      babelCore = require('babel-core'),
      {
        isStringLiteral, isImportDeclaration, isCallExpression, isDecorator, isIdentifier, isClassMethod,
        isObjectExpression, isObjectProperty, isLiteral, isClassDeclaration, isClassExpression, isClassProperty,
        isMemberExpression, isNumericLiteral, isArrayExpression, isUnaryExpression, isNullLiteral
      } = babelCore.types

let Undefined

class Transpiler {

  transpile(options, callback) {

    [options, callback] = resolveCallbackArguments(options, callback)

    options = this.constructor.normalizeOptions(options)

    return this._transpile(options)
      .then(result => callback(null, result))
      .catch(callback)

  }

  async _transpile(options) {
    void options
    throw Fault.create('kPureVirtual', { reason: 'Implement transpile(message) in your Transpiler class' })
  }

  static normalizeOptions(options) {
    return options || {}
  }

}

module.exports = class JavascriptTranspiler extends Transpiler {

  async _transpile(options) {

    let file, ast, source, imports = [], requires = [], classes = [], accounts = []

    try {
      const { Pipeline } = babelCore,
            babelOpts = {
              filename: options.filename,
              code: true,
              ast: true,
              comments: rBool(options.comments, false),
              retainLines: rBool(options.retainLines, true),
              parserOpts: {
                allowReturnOutsideFunction: rBool(options.allowReturnOutsideFunction, true),
                sourceType: rString(options.sourceType, 'module'),
                sourceFileName: options.filename
              },
              generatorOpts: {
                retainLines: rBool(options.retainLines, true),
                comments: rBool(options.comments, false),
                filename: options.filename,
                sourceFileName: options.filename
              },
              plugins: options.specification === 'es5' ? [] : es6BabelPlugins
            },
            pipeline = new Pipeline()

      file = pipeline.pretransform(options.source, babelOpts)

    } catch (e) {
      const err = Fault.create('kScriptCompilationError', { reason: 'There is an error in your script.', statusCode: 400 })
      if (e.loc) e.message += ' (line: ' + e.loc.line + ', col: ' + e.loc.column + ')'
      err.add(e)
      throw err
    }

    // pick out imports and classes
    await JavascriptTranspiler.traverseAstTree(
      pathTo(file.ast, 'program'),
      object => {

        // import x from 'y'
        if (isImportDeclaration(object)) {
          const source = object.source
          if (isStringLiteral(object.source) && !imports.includes(source.value)) {
            imports.push(source.value)
          }
          return false
        }

        // const x = require('y')
        if (isCallExpression(object)) {
          const callee = object.callee
          if (isIdentifier(callee) && callee.name === 'require') {
            const arg = object['arguments'] && object['arguments'][0]
            if (isStringLiteral(arg) && !requires.includes(arg.value)) {
              requires.push(arg.value)
            }
            return false
          }
        }

        // script.as('x')
        if (isCallExpression(object)) {
          const callee = object.callee
          if (isMemberExpression(callee) && isIdentifier(callee.object) && callee.object.name === 'script' && isIdentifier(callee.property) && callee.property.name === 'as') {
            const arg = object['arguments'] && object['arguments'][0]
            if (isStringLiteral(arg) && !accounts.includes(arg.value)) {
              accounts.push(arg.value)
            }
          }
        }

        // @as('x')
        if (isClassMethod(object)) {
          const decorators = toArray(object.decorators)
          for (const decorator of decorators) {
            if (isDecorator(decorator) && JavascriptTranspiler.getNameFromExpression(decorator.expression) === 'as') {
              const arg = toArray(decorator.expression['arguments'])[0]
              if (isStringLiteral(arg) && !accounts.includes(arg.value)) {
                accounts.push(arg.value)
              }
            }
          }
        }

        // classes and decorators
        if (isClassDeclaration(object) || isClassExpression(object)) {

          const { body: { body } = {}, decorators, loc } = object

          classes.push({

            name: JavascriptTranspiler.getPropertyName(pathTo(object, 'id')),

            loc: clone(pathTo(loc, 'start')),

            decorators: toArray(decorators)
              .map(JavascriptTranspiler.parseDecorator)
              .filter(isSet),

            properties: toArray(body)
              .map(JavascriptTranspiler.parseProperty)
              .filter(isSet),

            methods: toArray(body)
              .map(JavascriptTranspiler.parseMethod)
              .filter(isSet)

          })

        }

      }
    )

    // transform the code
    // store the ast in its original form. it gets transformed along with the transpile operation.
    if (options.ast) {
      ast = JSON.parse(JSON.stringify(file.ast))
    }

    try {
      source = file.transform().code
    } catch (e) {
      const err = Fault.create('kScriptCompilationError', { reason: 'There is an error in your script.', statusCode: 400 })
      if (e.loc) e.message += ' (line: ' + e.loc.line + ', col: ' + e.loc.column + ')'
      err.add(e)
      throw err
    }

    return {
      version,
      source,
      imports,
      requires,
      accounts,
      classes,
      ast,
      scriptHash: createHash('sha256').update(source).digest('hex')
    }

  }

  static normalizeOptions(options) {

    options = options || {}

    const source = _.isString(options.source) ? options.source : (options.source || '').toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim()
    if (source.length > bytes(config('transpiler.javascript.max_code_size'))) {
      throw Fault.create('kTooBig', { reason: 'request size too large' })
    }

    return {
      source: source,
      ast: rBool(options.ast, false),
      comments: rBool(options.comments, false),
      allowReturnOutsideFunction: rBool(options.allowReturnOutsideFunction, true),
      retainLines: rBool(options.retainLines, true),
      filename: rString(options.filename, 'Script').substr(0, 1024),
      specification: rString({ es5: 'es5', es6: 'es6' }[options.specification], 'es6'),
      sourceType: rString({ script: 'script', module: 'module' }[options.sourceType], 'module')
    }

  }

  static getNameFromExpression(v) {
    let name = null
    if (isCallExpression(v)) {
      name = JavascriptTranspiler.getPropertyName(v.callee)
    } else {
      name = JavascriptTranspiler.getPropertyName(v)
    }
    return name
  }

  static getPropertyName(key) {

    let name
    if (isIdentifier(key)) {
      name = key.name
    } else if (isStringLiteral(key)) {
      name = key.value
    } else if (isNumericLiteral(key)) {
      name = String(key.value)
    }
    return rString(name)

  }

  static parseProperty(property) {

    if (isClassProperty(property)) {
      const name = JavascriptTranspiler.getPropertyName(property.key)
      if (name) {

        const {
                decorators,
                static: static_,
                loc
              } = property,
              value = JavascriptTranspiler.parseArg(property.value)

        return {
          loc: clone(pathTo(loc, 'start')),
          kind: 'property',
          name,
          value,
          'static': static_,
          decorators: toArray(decorators).map(JavascriptTranspiler.parseDecorator).filter(isSet)
        }
      }
    }
  }

  static parseMethod(method) {

    if (isClassMethod(method)) {

      const name = JavascriptTranspiler.getPropertyName(method.key)

      if (name) {

        const {
          kind,
          static: static_,
          async,
          decorators,
          loc
        } = method

        return {
          loc: clone(pathTo(loc, 'start')),
          name,
          kind,
          'static': static_,
          async,
          decorators: toArray(decorators).map(JavascriptTranspiler.parseDecorator).filter(isSet)
        }

      }

    }

  }

  static parseDecorator(decorator) {

    if (isDecorator(decorator)) {

      const { expression, loc } = decorator,
            name = JavascriptTranspiler.getNameFromExpression(expression),
            params = isCallExpression(expression)
              ? toArray(expression.arguments).map(JavascriptTranspiler.parseArg).filter(isSet)
              : []

      return {
        loc: clone(pathTo(loc, 'start')),
        name,
        params
      }
    }

  }

  static parseArg(arg) {

    if (isObjectExpression(arg)) {

      return toArray(arg.properties).reduce((object, property) => {
        if (isObjectProperty(property)) {
          const name = JavascriptTranspiler.getPropertyName(property.key)
          if (name) {
            const value = JavascriptTranspiler.parseArg(property.value)
            if (value !== Undefined) {
              object[name] = value
            }
          }
        }
        return object
      }, {})

    } else if (isArrayExpression(arg)) {

      return toArray(arg.elements).map(JavascriptTranspiler.parseArg)

    } else if (isNullLiteral(arg)) {

      return null

    } else if (isLiteral(arg)) {

      return arg.value

    } else if (isUnaryExpression(arg)) {

      if (arg.prefix === true && arg.operator === '-' && isNumericLiteral(arg.argument)) {
        return -parseFloat(arg.argument.value)
      }

    }

  }

  static async traverseAstTree(object, handle) {

    const objectList = new Set(),
          stack = [ object ]

    return asyncWhile({
      profile: 'traverseAstTree',
      maxUs: 250,
      while: () => stack.length,
      do: () => {
        const value = stack.pop()
        if (typeof value === 'object' && !objectList.has(value)) {
          objectList.add(value)
          if (handle(value) === false) {
            return
          }
          for (let key in value) {
            if (typeof value.hasOwnProperty === 'function' && value.hasOwnProperty(key)) {
              stack.push(value[key])
            }
          }
        }
      }
    })

  }

}
