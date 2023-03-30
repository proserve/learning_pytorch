/* eslint-disable no-console */

'use strict'

const { promised } = require('../../../utils'),
      JavascriptTranspiler = require('../../sandbox/transpiler'),
      isCommandLine = (require.main === module)

module.exports = {

  build: function(callback) {

    const sh = require('shelljs'),
          fs = require('fs'),
          path = require('path'),
          transpiler = new JavascriptTranspiler(),
          modules = [
            'core.regexp.escape',
            'es6.symbol',
            'es6.map',
            'es6.set',
            'es6.weak-map',
            'es6.weak-set',
            'es6.parse-int',
            'es6.parse-float',
            'es6.promise',
            'es6.object.create',
            'es6.object.keys',
            'es6.object.is-extensible',
            'es6.object.assign',
            'es6.number.is-nan',
            'es6.number.is-finite',
            'es7.global',
            'es7.object.entries',
            'es7.object.values',
            'es6.object.is',
            'es6.object.set-prototype-of',
            'es6.function.name',
            'es6.function.has-instance',
            'es6.string.iterator',
            'es6.string.code-point-at',
            'es6.string.ends-with',
            'es6.string.includes',
            'es6.string.repeat',
            'es6.string.starts-with',
            'es6.array.from',
            'es6.array.some',
            'es6.array.every',
            'es6.array.fill',
            'es6.array.find',
            'es6.array.find-index',
            'es6.array.of',
            'es6.array.join',
            'es7.array.includes',
            'es6.array.iterator'
          ],
          supportedDecorators = [
            'autobind',
            'decorate',
            'deprecate',
            'enumerable',
            'extendDescriptor',
            ['lazy-initialize', 'lazyInitialize'],
            'nonconfigurable',
            'nonenumerable',
            'override',
            'readonly'
          ]

    process.chdir(__dirname)

    require('core-js-builder')({
      modules: modules,
      blacklist: [],
      library: false
    })
      .then(async(polyfill) => {

        const projectDir = path.join(__dirname, '../../../..'),
              srcDir = path.join(__dirname, 'src'),
              buildDir = path.join(__dirname, 'build'),
              buildModuleDir = `${buildDir}/modules`,
              regenerator = fs.readFileSync(`${projectDir}/node_modules/regenerator-runtime/runtime.js`),
              tempFiles = [],
              builtIns = (await promised(transpiler, 'transpile',
                {
                  source: fs.readFileSync(`${srcDir}/sandbox.js`),
                  language: 'javascript',
                  specification: 'es6',
                  filename: '__sandbox',
                  allowReturnOutsideFunction: false,
                  retainLines: false
                })).source,
              code = `                
            function() {                                                                 
                ${polyfill}                        
                // these are never referenced so hide them from prying eyes.
                delete global.core;        
                delete global['__core-js_shared__'];                                                                                                                                   
                ${regenerator}                                                                                                                                                          
                ${builtIns}                    
            }                     
            
        `

        fs.writeFileSync(`${buildDir}/sandbox.js`, code, 'utf8')

        // transform core-decorators
        sh.cp(`${projectDir}/node_modules/core-decorators/es/private/utils.js`, `${srcDir}/decorators/decorator-utils.js`)
        replaceInFile(`${srcDir}/decorators/decorator-utils.js`, '../lazy-initialize', 'decorators-lazyInitialize')
        tempFiles.push(`${srcDir}/decorators/decorator-utils.js`)

        // copy decorators to sandbox
        supportedDecorators.forEach(name => {
          const from = Array.isArray(name) ? name[0] : name,
                to = Array.isArray(name) ? name[1] : name
          sh.cp(`${projectDir}/node_modules/core-decorators/es/${from}.js`, `${srcDir}/decorators/decorators-${to}.js`)
          replaceInFile(`${srcDir}/decorators/decorators-${to}.js`, './private/utils', 'decorator-utils')
          tempFiles.push(`${srcDir}/decorators/decorators-${to}.js`)
        })

        // read all decorators to include custom ones
        let sep = '', tplDecorators = 'module.exports = Object.freeze(['
        fs.readdirSync(`${srcDir}/decorators`).forEach(file => {
          if (path.extname(file) === '.js') {
            const filename = path.basename(file, '.js')
            if (filename.indexOf('decorators-') === 0) {
              tplDecorators += sep + `'${filename.replace('decorators-', '')}'`
              sep = ','
            }
          }
        })
        tplDecorators += "].reduce((object, name) => {Object.defineProperty(object, name, {get:function(){return require('decorators-'+name);}});return object;},{}));"
        fs.writeFileSync(
          `${srcDir}/decorators/decorators.js`,
          tplDecorators,
          'utf8'
        )
        tempFiles.push(`${srcDir}/decorators/decorators.js`)

        // transpile local module code
        await Promise.all(['es6', 'decorators', 'deprecated', 'object-extensions', 'module-extensions', 'runtimes'].map(async dir => {
          const sourceDir = `${srcDir}/${dir}`
          await Promise.all(fs.readdirSync(sourceDir).map(async file => {
            if (path.extname(file) === '.js') {
              fs.writeFileSync(
                `${buildModuleDir}/${file}`,
                (await promised(transpiler, 'transpile', {
                  source: fs.readFileSync(`${sourceDir}/${file}`),
                  language: 'javascript',
                  specification: 'es6',
                  filename: path.basename(file, '.js'),
                  allowReturnOutsideFunction: false,
                  retainLines: true
                })).source,
                'utf8'
              )
            }
          }))
        }))

        // "transpile-able"
        await Promise.all(['vendor-transpile'].map(async dir => {
          const sourceDir = `${srcDir}/${dir}`
          await Promise.all(fs.readdirSync(sourceDir).map(async file => {
            if (path.extname(file) === '.js') {
              fs.writeFileSync(
                `${buildModuleDir}/${file}`,
                (await promised(transpiler, 'transpile', {
                  source: fs.readFileSync(`${sourceDir}/${file}`),
                  language: 'javascript',
                  specification: 'es6',
                  filename: path.basename(file, '.js'),
                  allowReturnOutsideFunction: false,
                  retainLines: false
                })).source,
                'utf8'
              )
            }
          }))
        }))

        // straight copy
        ;['vendor'].forEach(dir => {
          const sourceDir = `${srcDir}/${dir}`
          fs.readdirSync(sourceDir).forEach(file => {
            if (path.extname(file) === '.js') {
              fs.writeFileSync(
                `${buildModuleDir}/${file}`,
                fs.readFileSync(`${sourceDir}/${file}`),
                'utf8'
              )
            }
          })
        })

        // cleanup
        tempFiles.forEach(f => fs.unlinkSync(f))

      })
      .then(() => callback())
      .catch(err => callback(err))

    function replaceInFile(file, regex, replace) {
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(regex, replace),
        'utf8'
      )
    }
  }

}

// -------------------------------------------

if (isCommandLine) {

  process.___service_root_init_dir = __dirname

  module.exports.build(err => {
    if (err) {
      console.log('sandbox build failed!', err)
      process.exit(1)
    } else {
      console.log('sandbox build complete!')
    }
  })

}
