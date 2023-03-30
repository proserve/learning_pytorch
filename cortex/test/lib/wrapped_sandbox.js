'use strict'

const server = require('./server'),
      async = require('async'),
      modules = require('../../lib/modules'),
      models = modules.db.models,
      path = require('path'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      utils = require('../../lib/utils'),
      acl = require('../../lib/acl')

module.exports = function(file, mod) {

  return function() {

    const parts = file.split('.'),
          section = parts[0],
          label = parts.slice(1, parts.length - 1).join('.')

    describe(section, function() {

      const title = label + ' should ' + (mod.fault ? ('fail with ' + mod.fault) : 'succeed')

      it(title, function(callback) {

        const Sandbox = modules.sandbox,
              ac = new acl.AccessContext(mod.principal || server.principals.admin),
              transpilerOptions = {
                label: utils.rString(mod.label, 'Script'),
                language: mod.language,
                specification: mod.specification,
                type: utils.rString(mod.scriptType, 'route')
              },
              source = _.isString(mod.main) ? mod.main : (mod.main || '').toString().replace(/^function[\s]{0,}\(\)[\s]{0,}{([\s\S]*)}$/, '$1').trim()

        modules.services.transpiler.transpile(source, transpilerOptions, (err, transpilerResult) => {

          if (err) {
            return callback(err)
          }

          const Script = models.getModelForType('script', transpilerOptions.type),
                model = new Script({
                  _id: utils.createId(),
                  org: ac.orgId,
                  object: 'script',
                  active: true,
                  label: transpilerOptions.label,
                  script: source,
                  compiled: transpilerResult.source,
                  type: transpilerOptions.type
                }),
                tasks = []

          if (mod.before) {
            tasks.push(callback => {
              mod.before.call(this, ac, model, err => {
                callback(err)
              })
            })
          }

          tasks.push(callback => {
            if (mod.skip) {
              if (mod.after) {
                mod.after.call(this, null, true, ac, model, callback)
              } else {
                callback(null, true)
              }
            } else {
              Sandbox.executeModel(ac, null, model, (err, { results } = {}) => {
                if (mod.after) {
                  mod.after.call(this, err, results, ac, model, callback)
                } else {
                  callback(err, results)
                }
              })
            }
          })

          async.waterfall(tasks, (err, result) => {
            err = Fault.from(err)
            if (mod.fault) {
              if (err) {
                if (err.errCode === mod.fault || err.code === mod.fault) {
                  err = null
                }
              } else {
                err = new Error('script expected a "' + mod.fault + '" error.')
              }
            }
            if (!err && !mod.fault && result !== true) {
              err = new Error('script returned false but without a good reason.')
            }
            if (err) {
              console.error(JSON.stringify(err.toJSON(), null, 4))
            }
            callback(err)
          })

        })

      })

    })

  }

}

/**
 * returns capitalized name from last component of filename's dirname
 */
module.exports.section = function(filename) {
  const section = _.last(path.dirname(filename).split(path.sep))
  return section.charAt(0).toUpperCase() + section.slice(1)
}

/**
 * returns the capitalized first component (split by '.' of the filename).
 */
module.exports.title = function(filename) {

  const title = path.basename(filename).split('.')[0]
  return title.charAt(0).toUpperCase() + title.slice(1)
}

module.exports.wrap = function(filename, mod) {

  const label = path.basename(filename, '.js').split('.').slice(1).join('.')

  return [

    label + ' should ' + (mod.fault ? ('fail with ' + mod.fault) : 'succeed'),

    function(callback) {

      const Sandbox = modules.sandbox,
            ac = new acl.AccessContext(server.principals[mod.principal] || server.principals.admin),
            transpilerOptions = {
              label: utils.rString(mod.label, 'Script'),
              language: mod.language,
              specification: mod.specification,
              type: utils.rString(mod.scriptType, 'route')
            },
            source = _.isString(mod.main) ? mod.main : (mod.main || '').toString().replace(/^function[\s]{0,}\(\)[\s]{0,}{([\s\S]*)}$/, '$1').trim()

      modules.services.transpiler.transpile(source, transpilerOptions, (err, transpilerResult) => {

        const tasks = []

        if (err) {

          tasks.push(callback => {
            if (mod.after) {
              mod.after.call(this, err, null, ac, null, callback)
            } else {
              callback(err)
            }
          })

        } else {

          const Script = models.getModelForType('script', transpilerOptions.type),
                model = new Script({
                  _id: utils.createId(),
                  org: ac.orgId,
                  object: 'script',
                  active: true,
                  label: transpilerOptions.label,
                  script: source,
                  compiled: transpilerResult.source,
                  type: transpilerOptions.type
                })

          if (mod.before) {
            tasks.push(callback => {
              mod.before.call(this, ac, model, err => {
                callback(err)
              })
            })
          }

          tasks.push(callback => {
            if (mod.skip) {
              if (mod.after) {
                mod.after.call(this, null, true, ac, model, callback)
              } else {
                callback(null, true)
              }
            } else {
              Sandbox.executeModel(ac, null, model, (err, { results } = {}) => {
                if (mod.after) {
                  mod.after.call(this, err, results, ac, model, callback)
                } else {
                  callback(err, results)
                }
              })
            }
          })

        }

        async.waterfall(tasks, (err, result) => {
          err = Fault.from(err)
          if (mod.fault) {
            if (err) {
              if (err.errCode === mod.fault || err.code === mod.fault) {
                err = null
              }
            } else {
              err = new Error('script expected a "' + mod.fault + '" error.')
            }
          }
          if (!err && !mod.fault && result !== true) {
            err = new Error('script returned false but without a good reason.')
          }
          if (err) {
            console.error(JSON.stringify(err.toJSON(), null, 4))
          }
          callback(err)
        })

      })
    }
  ]

}
