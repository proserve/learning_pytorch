'use strict'

const mongoose = require('./mongoose'),
      utils = require('../../utils'),
      consts = require('../../consts'),
      Startable = require('cortex-service/lib/startable'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../index'),
      fs = require('fs'),
      path = require('path'),
      _ = require('underscore'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../acl'),
      ap = require('../../access-principal'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      MongoErrorMap = {
        2: 'cortex.invalidArgument.badDbValue',
        50: 'cortex.timeout.dbQuery',
        52: 'cortex.invalidArgument.dollarPrefixedDbKey',
        57: 'cortex.invalidArgument.dottedDbFieldName',
        11000: 'cortex.conflict.duplicateKey',
        11001: 'cortex.conflict.duplicateKey'
      }

Fault.addConverter(function mongoErrorConverter(err) {
  if (err instanceof Error && err.name === 'MongoError') {
    let errCode = MongoErrorMap[err.code]
    if (errCode) {
      let obj = {}
      if (err.code === 2) {
        const reason = utils.array(utils.rString(err.message, '').match(/errmsg: "([^"]*)"/))[1] || err.errmsg || err.message
        if (reason) {
          obj.reason = reason
        }
      }
      err = Fault.create(errCode, obj)
    } else {
      if (config('debug.exposeMongoErrors')) {
        err = Fault.create('cortex.error.db', { reason: err.message })
      } else {
        logger.error('database error', utils.toJSON(err, { stack: true }))
        err = Fault.create('cortex.error.db')
      }
    }
  }
  return err

})

class Models {

  constructor() {
    return new Proxy(this, {
      get(target, name) {
        if (name in target) {
          return target[name]
        }
        name = String(name).toLowerCase()
        if (name in target) {
          return target[name]
        }
        target[name] = mongoose.model(name)
        return target[name]
      }
    })
  }

  getModelForType(name, type) {
    return this[name].getModelForType(type)
  }

}

class DatabaseModule extends Startable {

  constructor(options) {

    super('database', options)

    this._commands = new Set()
    this._connection = mongoose.connection
    this._connection
      .on('connecting', () => this.__log('connecting'))
      .on('authenticated', () => this.__log('authenticated'))
      .on('close', err => this.__log('closed', err))
      .on('error', err => this.__log('error', err))
      .on('fullsetup', () => this.__log('fullsetup'))
      .on('parseError', err => this.__log('parseError', err))
      .on('reconnect', () => this.__log('reconnect'))
      .on('timeout', err => this.__log('timeout', err))

    this._models = new Models(this)
    this._definitions = null

    modules.metrics.register('db', () => ({
      num_running_operations: this.numRunningOperations
    }))
  }

  get connection() {
    return this._connection
  }

  get models() {
    return this._models
  }

  get mongoose() {
    return this._mongoose || (this._mongoose = require('./mongoose'))
  }

  get definitions() {
    return this._definitions || (this._definitions = require('./definitions'))
  }

  get numRunningOperations() {
    return this._commands.size
  }

  getRootDocument(doc) {
    let root
    while (doc) {
      root = doc
      doc = this.getParentDocument(doc)
    }
    return root
  }

  getDocumentSetError(doc) {

    const top = this.getRootDocument(doc),
          err = utils.path(top, '$__.saveError')

    if (err) {
      try {
        const node = top.schema.node.findNode(err.path)
        if (node) {
          err.path = node.fullpath
        }
      } catch (e) {
        err.path = ''
      }
    }
    return err

  }

  getParentDocument(doc, direct = true) {
    if (doc) {
      if (doc.$__parent) {
        if (direct) {
          return doc.$__parent
        }
        while (doc.$__parent) {
          doc = doc.$__parent
        }
        return doc
      }
      if (doc.$__) {
        if (!doc.$__.scope || doc.$__.scope === doc) {
          if (typeof doc.parent === 'function') {
            return doc.parent()
          }
        } else {
          return doc.$__.scope
        }
      }
    }
    return null
  }

  normalizeDependencyValue(value) {
    if (!_.isBoolean(value) && !_.isFunction(value) && !_.isObject(value)) {
      if (utils.isInteger(value)) {
        value = parseInt(value) > 0
      } else {
        value = !!value
      }
    }
    return value
  }

  isModelInstance(v) {

    return (v instanceof mongoose.Model)

  }

  getModelOrId(value) {
    if (value) {
      if (this.isModelInstance(value)) {
        return value
      }
      if (utils.isId(value)) {
        return value
      }
      try {
        if (utils.isIdFormat(value)) {
          return utils.createId(value)
        }
      } catch (err) {}
    }
    return null
  }

  normalizeDependencies(deps) {

    if (!deps) {
      return null
    }

    // resolve full path of any dependencies. these are the direct, non-resolved dependencies.
    deps = _.isString(deps) ? [deps] : (_.isArray(deps) || _.isObject(deps)) ? deps : {}

    // convert direct dependencies to object
    if (_.isArray(deps)) {
      const arr = deps
      deps = {}
      arr.forEach(path => {
        deps[path] = true
      })
    }

    // normalize values.
    for (let path in deps) {
      if (deps.hasOwnProperty(path)) {
        deps[path] = this.normalizeDependencyValue(deps[path])
      }
    }

    return deps
  }

  bootstrap(callback) {

    if (!config('debug.doBootstrap')) {
      return callback()
    }

    const Org = modules.db.models.Org,
          user = _.extend({
            email: 'james@medable.com',
            password: modules.authentication.generatePassword(config('auth.maxPasswordLength')),
            name: { first: 'System', last: 'Admin' },
            mobile: '+16049892489',
            roles: [acl.OrgAdminRole]
          }, config('init.user')),
          org = new Org({
            name: acl.BaseOrgName,
            org: acl.BaseOrg,
            object: 'org',
            _id: acl.BaseOrg,
            state: 'enabled',
            reap: false,
            code: 'medable',
            acl: [],
            aclv: 0,
            sequence: 0,
            configuration: {
              email: {
                locationBypass: [user.email]
              }
            },
            dataset: {
              collection: 'contexts'
            }
          })

    async.series([

      // create org
      callback => org.nodeSave(new acl.AccessContext(ap.synthesizeAnonymous(org), org), err => {
        err = Fault.from(err)
        if (err) {
          if (err.errCode === 'cortex.conflict.duplicateKey' ||
              (err.errCode === 'cortex.invalidArgument.validation' &&
                utils.array(err.faults).length === 1 &&
                _.find(err.faults, f => f.path === 'org.code' && f.errCode === 'cortex.conflict.exists')
              )
          ) {
            err = null
          }
        }
        callback(err)
      }),

      // create initial indexes
      callback => modules.db.definitions.ensureIndexes(false, (err) => {
        if (err) {
          logger.error('error ensuring indexes during bootstrap', utils.toJSON(err, { stack: true }))
        }
        callback()
      }),

      // provision initial account
      callback => modules.accounts.provisionAccount(
        null,
        user,
        org,
        'en_US',
        'verified',
        null,
        {
          skipSelfRegistrationCheck: true,
          skipActivation: true,
          isProvisioned: true,
          sendWelcomeEmail: false,
          allowDirectRoles: true,
          accountObject: {
            _id: acl.SystemAdmin
          }
        }, err => {
          if (err) {
            if (err.errCode === 'cortex.conflict.duplicateKey' ||
                err.errCode === 'cortex.conflict.duplicateEmail' ||
                (err.errCode === 'cortex.invalidArgument.validation' && utils.array(err.faults).length === 1 && _.find(err.faults, f => f.errCode === 'cortex.conflict.duplicateEmail'))
            ) {
              err = null
            }
          }
          callback(err)
        }
      ),

      // install base templates
      callback => modules.db.models.Template.installOrgTemplates(acl.BaseOrg, { overwrite: true }, callback)

    ], callback)

  }

  _waitStart(callback) {

    logger.info('Opening connection to Cortex Environments DB')

    // for now, mongoose.connection contains org config and environment databases.
    const { uri, options } = config('databases.cortex.environments')

    mongoose.connect(uri, options, err => {

      this.connection.client
        .on('commandStarted', cmd => this._commands.add(cmd.requestId))
        .on('commandSucceeded', cmd => this._commands.delete(cmd.requestId))
        .on('commandFailed', cmd => this._commands.delete(cmd.requestId))

      if (err) {
        logger.error('MongoDB connection error', utils.toJSON(err, { stack: true }))
        return callback(err)
      }

      // load non-definition models.
      const modelsDir = `${__dirname}/models`,
            files = fs.readdirSync(modelsDir)

      files.forEach(modelFile => {
        if (modelFile[0] !== '.') {
          const fullpath = path.join(modelsDir, modelFile)
          let name = path.basename(modelFile, '.js').replace(/[-_]/g, '')
          try {
            if (fs.statSync(fullpath).isFile()) {
              const schema = require(fullpath)(mongoose)
              schema.options.autoIndex = false
              name = name.toLowerCase()
              mongoose.model(name, schema)
            } else {
              logger.error('Model not found (' + fullpath + ')')
            }
          } catch (e) {
            logger.error(`Failed to load model ${fullpath}`, utils.toJSON(e, { stack: true }))
          }
        }
      })

      // initialize definitions
      this.definitions.initialize(err => {

        if (err) {
          return callback(err)
        }

        // wait for result.
        this.models.org.findOne({}, callback)

      })

    })

  }

  _waitStop(callback) {

    async.series([

      // wait a cycle to allow anything that might have need for a final write
      callback => setImmediate(callback),

      // wait until all mongodb connections have been closed.
      callback => {

        if (this.numRunningOperations > 0) {
          logger.info('waiting for db operations to complete.')
        }
        async.until(
          () => this.numRunningOperations === 0,
          callback => {
            setTimeout(callback, 10)
          },
          callback)
      },

      // close all connections
      callback => {

        callback = _.once(callback)
        try {
          mongoose.disconnect(callback)
        } catch (err) {
          logger.error('attempting to close mongo connection', utils.toJSON(err, { stack: true }))
          callback(err)
        }
      }

    ], err => {
      logger.info('db module stopped')
      callback(err)
    })

  }

  /**
     * low-level sequenced update without triggers or index updates.
     *
     * @param Model
     * @param match
     * @param update {$set, $unset, $inc, ...}. NOTE: update is modified by the function.
     * @param options
     *  select - force path selections
     * @param callback -> err, doc
     */
  sequencedUpdate(Model, match, update, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    const _id = utils.getIdOrNull(match, false),
          select = options.select
            ? `${options.select} sequence`
            : Object.keys(utils.flattenObjectPaths(update, false, true)).reduce((select, path) => `${select} ${path}`, 'sequence meta')

    if (_id) {
      match = { _id }
    } else if (!utils.isPlainObject(match)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Expecting match or _id ' }))
    }

    match = Object.assign({}, match, { reap: false })
    update = utils.path(update || {}, '$inc.sequence', 1, true)

    modules.db.sequencedFunction(
      function(callback) {
        Model.findOne(match).select(select).lean().exec((err, doc) => {
          if (err || !doc) {
            return callback(err, doc)
          }

          const sequence = doc.sequence

          if (update.$set && _.isArray(update.$set['meta.up'])) {
            update.$set['meta.up'] = _.uniq(update.$set['meta.up'].concat(consts.metadata.updateBits.documentSize))
            if (Model.dataset && Model.dataset.targetCollection) {
              update.$set['meta.up'] = _.uniq(update.$set['meta.up'].concat(consts.metadata.updateBits.migrate))
            }
          } else {
            let metaUp = (update.$addToSet || (update.$addToSet = {}))['meta.up'] || (update.$addToSet['meta.up'] = { $each: [] })
            if (_.isNumber(metaUp)) {
              metaUp = (update.$addToSet['meta.up'] = { $each: [] })
            }
            metaUp.$each.push(consts.metadata.updateBits.documentSize)
            if (Model.dataset && Model.dataset.targetCollection) {
              metaUp.$each.push(consts.metadata.updateBits.migrate)
            }
          }

          Model.collection.updateOne(
            Object.assign({}, match, { sequence }),
            update,
            (err, result) => {
              if (!err && result['matchedCount'] === 0) {
                err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error (su)' })
              }
              callback(err, doc)
            }
          )
        })
      },
      10,
      callback
    )

  }

  sequencedFunction(fn, tries, options, callback) {

    if (!utils.isInt(tries)) {
      callback = options
      options = tries
    }
    [options, callback] = utils.resolveOptionsCallback(options, callback)

    options._initialTries = utils.rInt(options._initialTries, utils.rInt(tries, 10))
    fn((err, ...rest) => {
      tries -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : tries
      if (tries) {

        let delay = utils.rInt(options['delayModifier'], Math.floor(Math.random() * 8)) // 5-7 ms

        const delayScalar = utils.rInt(options['delayScalar'], 1.0),
              delayMultiplies = utils.rBool(options['delayMultiplies'], false),
              delayAdds = utils.rBool(options['delayAdds'], true)

        if (delayAdds) {
          delay = delay * (options._initialTries - tries) * delayScalar
        } else if (delayMultiplies) {
          delay = Math.pow(delay, options._initialTries - tries) * delayScalar
        }
        logger.info('sequencedFunction() sequencing error tries left: ' + tries + '. ' + (delay > 0 ? 'Waiting: ' + delay + 'ms' : 'Trying again immediately.') + (options.message ? ' ' + options.message : ''))
        if (delay > 0) {
          setTimeout(() => {
            this.sequencedFunction(fn, tries, options, callback)
          }, parseInt(delay))
        } else {
          setImmediate(() => {
            this.sequencedFunction(fn, tries, options, callback)
          })
        }
      } else {
        callback(err, ...rest)
      }
    })
  }

  // @todo add increasing time scale as failures increase?
  sequencedWaterfall(tasks, tries, callback) {
    async.waterfall(tasks, (err, ...rest) => {
      tries -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : tries
      if (tries) {
        setImmediate(() => {
          this.sequencedWaterfall(tasks, tries, callback)
        })
      } else {
        if (_.isFunction(callback)) {
          callback(err, ...rest)
        }
        callback = tries = tasks = null
      }
    })
  }

  sequencedSeries(tasks, tries, callback) {
    async.series(tasks, (err, ...rest) => {
      tries -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : tries
      if (tries) {
        setImmediate(() => {
          this.sequencedSeries(tasks, tries, callback)
        })
      } else {
        if (_.isFunction(callback)) {
          callback(err, ...rest)
        }
        callback = tries = tasks = null
      }
    })
  }

  get initialBulkInsertIndex() {
    return 0
  }

}

module.exports = new DatabaseModule()
