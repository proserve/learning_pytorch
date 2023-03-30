'use strict'

const utils = require('../../lib/utils'),
      Messages = require('../../lib/modules/sandbox/messages'),
      Connection = require('../../lib/modules/sandbox/connections/worker-host'),
      JavascriptTranspiler = require('../../lib/modules/sandbox/transpiler'),
      transpiler = new JavascriptTranspiler()

function createRemoteApi(ins) {
  return Object.keys(ins || {}).reduce((api, name) => {
    const val = ins[name]
    if (typeof val === 'function') {
      api[name] = { $len: val.$is_var_args ? -1 : val.length - 1 }
    } else if (utils.isPlainObject(val)) {
      const out = createRemoteApi(val)
      if (out) {
        api[name] = out
      }
    } else if (val !== undefined) {
      api[name] = val
    }
    return api
  }, {})
}

function runInNewWorker(source,
  name,
  sandboxArguments,
  sandboxConfiguraton,
  sandboxApi,
  scriptConfiguration,
  scriptEnvironment,
  callback) {

  const runId = utils.createId().toString(),
        connection = new Connection(sandboxArguments)

  connection.open()

  setImmediate(function() {

    connection.send(new Messages.Init(sandboxConfiguraton))

    connection.once('ready', () => {
      connection.on('message', message => {
        const type = message.type
        if (type === Messages.Codes.kResult) {
          connection.close()
          callback(message.err, message.result)
        } else if (type === Messages.Codes.kTask) {
          const kindApi = sandboxApi[message.kind]
          if (kindApi) {
            const parts = utils.pathParts(message.command)
            let handlerObj, handlerName, handlerFn
            handlerObj = parts[1] ? utils.path(kindApi, parts[0]) : kindApi
            handlerName = utils.rString(parts[1] || parts[0], '')
            handlerFn = utils.path(handlerObj, handlerName)
            if (handlerFn) {
              message.payload = utils.array(message.payload)
              const payloadArguments = handlerFn.$is_var_args ? [message.payload] : message.payload
              if (!handlerFn.$is_var_args) {
                payloadArguments.length = handlerFn.length - 1 // ..., callback
              }
              handlerFn.call(handlerObj, ...payloadArguments, (err, result, resultOptions) => {
                const options = {
                  taskId: message.taskId,
                  kind: message.kind,
                  command: message.command,
                  err: err,
                  result: result,
                  raw: resultOptions && resultOptions.raw
                }
                new Messages.TaskResult(runId, options).send(connection)
              })
              return
            }
          }
          new Messages.TaskResult(runId, {
            taskId: message.taskId,
            kind: message.kind,
            command: message.command,
            err: new Error('Invalid Api Command')
          }).send(connection)
        }
      })

      new Messages.Script(runId, { source: `function ${name}(){'use strict';${source}\n}`, configuration: scriptConfiguration, environment: scriptEnvironment }).send(connection)

    })
  })
}

// ---------------------------------------------------

function transpile(filename, source, callback) {

  const transpileOptions = {
    filename: filename,
    source: source,
    language: 'javascript',
    specification: 'es6'
  }

  transpiler.transpile(transpileOptions, (err, compiled) => {
    callback(err, err ? null : compiled.source)
  })
}

module.exports = function sandboxed(main, options) {

  options = options || {}
  const config = {
          transpile: utils.rBool(options.transpile, true),
          require: (typeof options.require === 'function') ? options.require : function(module, callback) {
            callback(new Error('Module Not Found'))
          }
        },
        sandboxApi = {
          object: {},
          module: options.api || {},
          internal: {
            require: function(module, callback) {
              config.require(module, (err, mod) => {
                callback(err, mod, { raw: true })
              })
            }
          }
        }

  let name,
      source,
      sandboxArguments,
      sandboxConfiguraton,
      scriptConfiguration,
      scriptEnvironment,
      queue

  if (typeof main === 'function') {
    const match = main.toString().match(/^function[\s]{0,}([$A-Z_][0-9A-Z_$]*)?\(([^)]*)?\)[\s]{0,}\{([\s\S]*)\}$/i)
    if (!match) {
      return callback => {
        callback(new Error('Invalid Main Function'))
      }
    }
    name = match[1] || 'main'
    source = match[3]
  } else {
    source = main
    name = 'main'
  }
  config.filename = utils.rString(options.filename, 'Script')
  config.source = (typeof source === 'string' ? source : source.toString()).replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim()
  config.transpiled = utils.rBool(options.transpile, true) ? null : config.source

  sandboxArguments = {
    bootstrap: utils.rString(options.bootstrap, null), // by default, do not load bootstrap js.
    jspath: utils.rString(options.jspath, null) // by default, do not load native remove modules.
  }

  sandboxConfiguraton = {
    apis: {
      object: createRemoteApi(sandboxApi.object),
      module: createRemoteApi(sandboxApi.module),
      internal: createRemoteApi(sandboxApi.internal)
    },
    debug: {
      enableDebugModule: utils.rBool(options.enableDebugModule, true)
    }
  }

  scriptConfiguration = {
    maxOps: utils.rInt(options.maxOps, 10000000), // 10m
    timeoutMs: utils.rInt(options.timeoutMs, 10000) // 10s
  }

  scriptEnvironment = options.environment || {} // global 'env' object

  function drain() {
    for (let callback of queue) {
      run(callback)
    }
    queue = null
  }

  function run(callback) {
    runInNewWorker(
      config.transpiled,
      name,
      sandboxArguments,
      sandboxConfiguraton,
      sandboxApi,
      scriptConfiguration,
      scriptEnvironment,
      callback
    )
  }

  return callback => {

    // only transpile on the first run, and only 1 at a time.
    if (!config.transpiled) {
      if (queue) {
        queue.add(callback)
        return
      }
      queue = new Set()
      queue.add(callback)
      transpile(config.filename, config.source, (err, transpiled) => {
        if (err) {
          return callback(err)
        }
        config.transpiled = transpiled
        drain()
      })
      return
    }
    run(callback)
  }

}

// ------------------------------

// function testRun() {
//
//   const argv = process.argv.reduce(function(options, v, i, argv) {
//           if (v.indexOf('--') === 0 && v.length > 2) {
//             options[v.substr(2)] = true
//           } else if (v.indexOf('-') === 0 && v.length > 1 && v.substr(1) !== '-') {
//             options[v.substr(1)] = argv[i + 1]
//           }
//           return options
//         }, {}),
//         fn = module.exports(
//
//           // main function
//           argv.s ||
//         (argv.f ? require('fs').readFileSync(argv.f, 'utf8') : false) ||
//         function() {
//
//           return 1
//
//         }, {
//
//             transpile: !!argv.t,
//
//             enableDebugModule: true,
//
//             require: function(module, callback) {
//               return callback(new Error('Module Not Found'))
//             },
//
//             api: {
//               debug: {
//                 echo: function(val, callback) {
//                   callback(null, val)
//                 }
//               }
//             },
//
//             environment: {
//               foo: 'bar'
//             }
//
//           }
//
//         ),
//         numScripts = 100,
//         concurrent = 1,
//         start = Date.now()
//
//   let ran = 0, counted = 0, roundTrip = 0
//
//   require('async').timesLimit(
//     numScripts,
//     concurrent,
//     (n, callback) => {
//
//       fn(function(err, result) {
//         ran++
//         if (!err) {
//           counted++
//           roundTrip += result
//         }
//         console.log(err ? err.toJSON() : JSON.stringify(result))
//         callback(err)
//       })
//     },
//     err => {
//       console.log(err ? err.toJSON() : 'Ok!', `Ran ${ran}/${numScripts} with concurrency of ${concurrent} in ${Date.now() - start}ms. Round-trip echo() averages ${(roundTrip / counted).toFixed(2)}ms `)
//       process.exit(err ? 1 : 0)
//     }
//   )
//
// }
