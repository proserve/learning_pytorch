'use strict'

const { toJSON, rString, sleep, isSet, array: toArray, promised, roughSizeOfObject, rInt, serializeObject, encodeME, decodeME } = require('../../utils'),
      Startable = require('cortex-service/lib/startable'),
      modules = require('../../modules'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      consts = require('../../consts'),
      AccessPrincipal = require('../../access-principal'),
      { AccessContext } = require('../../acl'),
      config = require('cortex-service/lib/config'),
      later = require('later'),
      { Driver } = modules.driver

let Undefined

class EventsModule extends Startable {

  #running = false
  #lastDoc = null
  #pollIn = 0
  #curPoll = 0
  #numProcessed = 0
  #lastProcessed
  #numLoops = 0
  #options = {
    minPoll: 100,
    maxPoll: 1000,
    pollBackOffScalar: 1.5,
    maxConcurrentMessages: 50,
    readPreference: 'primary',
    writeConcern: 'majority'
  }
  #inFlight = new Set()
  #lookupStates = [consts.events.states.pending, consts.events.states.scheduled]

  constructor() {

    super('events')

    Object.assign(this.#options, config('events'))

    modules.services.api.addCommand('module.events.poll', (payload, callback) => {
      this.#pollIn = 0
      this.#curPoll = 0
      callback()
    })

  }

  toJSON() {

    return {
      ...super.toJSON(),
      running: this.#running,
      state: this.state,
      pollIn: this.#pollIn,
      curPoll: this.#curPoll,
      lastDoc: this.#lastDoc,
      inflight: this.#inFlight.size,
      numProcessed: this.#numProcessed,
      numLoops: this.#numLoops,
      lastProcessed: this.#lastProcessed
    }
  }

  get numProcessed() {
    return this.#numProcessed
  }

  getNextScheduledTimes(cron, count = 1) {

    let schedule

    if (rString(cron)) {

      const parts = cron.split(' '),
            hasMinutes = parts.length === 5,
            hasSeconds = parts.length === 6

      if (hasMinutes || hasSeconds) {
        try {
          const parsed = later.parse.cron(cron, hasSeconds)
          schedule = later.schedule(parsed)
        } catch (e) {}
      }
    }
    if (schedule && schedule.isValid()) {
      return schedule.next(count)
    }
    return []

  }

  _waitStart(callback) {

    this.once('started', () => {

      this._run().catch(err => {
        logger.error('[module.events]', toJSON(err))
      })

    })

    callback()

  }

  _waitStop(callback) {

    // wait for the run process to receive the signal
    Promise.resolve(null)
      .then(async() => {
        logger.info('stopping user-land event loop...')
        while (this.#running) {
          await sleep(100)
        }
        logger.info('user-land event loop stopped.')
        callback()
      })
  }

  poll(shardKey = null) {

    let endpoint

    if (isSet(shardKey)) {
      endpoint = modules.services.api.shardKeyToEndpoint(shardKey, modules.services.api.endpoints.length)
    }

    if (endpoint === modules.services.api.selfName) {
      this.#pollIn = 0
      this.#curPoll = 0
    } else {
      modules.services.api.command('module.events.poll', { endpoint })
    }

  }

  async _run() {

    if (this.#running) {
      logger.error('_run called while already running!')
      return
    }

    while (this.isStarted) {

      if (this.#inFlight.size < this.#options.maxConcurrentMessages) {

        const docs = await this._next(this.#options.maxConcurrentMessages - this.#inFlight.size)

        if (docs.length && this.isStarted) {

          this.#curPoll = 0

          for (const doc of docs) {

            this.#lastDoc = doc
            if (isSet(doc.expiresAt) && doc.expiresAt <= new Date()) {
              await this._expire(doc)
            } else if (doc.state === consts.events.states.scheduled) {
              await this._schedule(doc)
            } else {
              await this._process(doc)
            }

          }

        }

      }

      // wait for the next poll time in small increments to be able to respond to shutdown and poll events.
      await this._wait()

      this.#numLoops += 1
    }

    this.#running = false
  }

  async _next(limit = this.#options.maxConcurrentMessages) {

    try {

      // find docs on this shard that are ready to process.
      const { Event } = modules.db.models

      return await Event.collection
        .find(
          {
            shardKey: {
              $gte: modules.services.api.lowerBoundShardKey,
              $lte: modules.services.api.upperBoundShardKey
            },
            state: {
              $in: this.#lookupStates
            },
            start: {
              $lte: new Date()
            },
            reap: false,
            object: 'event'
          },
          { hint: 'idxQueue',
            limit,
            sort: {
              start: 1
            },
            readPreference: this.#options.readPreference
          }
        ).project(
          // only get the fields we absolutely need to pre-process. get the payload and others when we lock for update.
          {
            _id: 1,
            state: 1,
            start: 1,
            name: 1,
            schedule: 1,
            started: 1,
            count: 1,
            org: 1,
            object: 1,
            type: 1,
            sequence: 1,
            expiresAt: 1
          }
        ).toArray()

    } catch (err) {

      logger.error('[module.events._next]', toJSON(err, { stack: true }))
    }

    return []

  }

  async _schedule(doc) {

    try {

      // update to next time
      let start
      if (doc.schedule === '* * * * * *') {
        start = new Date(Date.now() + 1000)
      } else if (doc.schedule === '* * * * *') {
        start = new Date(Date.now() + 60000)
      } else {
        // space out events by at least 1 second.
        const next = this.getNextScheduledTimes(doc.schedule, 2),
              min = new Date(Date.now() + 1000)
        if (next[0] && (start = next[0]) < min) {
          if (next[1] && (start = next[1]) < min) {
            start = min
          }
        }
      }

      const { Event } = modules.db.models,
            find = { _id: doc._id, count: doc.count, sequence: doc.sequence, reap: false },
            update = {
              $set: {
                start,
                started: new Date()
              },
              $inc: {
                count: 1,
                sequence: 1
              }
            },
            result = await Event.collection.findOneAndUpdate(find, update, { returnDocument: 'after', writeConcern: { w: this.#options.writeConcern } }),
            value = decodeME(result && result.value)

      if (value) {

        const Model = Event.getModelForType(value.type),

              // schedule immediately
              event = new Model({
                org: value.org,
                object: value.object,
                type: value.type,
                parent: value._id,
                parentKey: value.key,
                principal: value.principal,
                retention: isSet(value.retention) ? value.retention : consts.events.retention.never
              })

        switch (value.type) {

          case 'script':
            event.event = value.event
            event.param = value.param
            break

          case 'driver':
            event.options = value.options
            event.privileged = value.privileged
            break

          case 'console':
            event.param = value.param
            break

          case 'notification':
            event.name = value.name
            event.variables = value.variables
            event.options = value.options
            break

        }

        await Event.collection.insertOne(
          event.toObject(),
          {
            w: this.#options.writeConcern
          })

      }

    } catch (err) {

      logger.error('[module.events._schedule]', toJSON(err, { stack: true }))
    }
  }

  async _process(doc) {

    try {

      const { Event, Org, Console } = modules.db.models,
            { sandbox } = modules,
            canRunScript = doc.type !== 'script' || sandbox.canRunScript(doc.org),
            find = { _id: doc._id, state: doc.state, start: doc.start, sequence: doc.sequence, reap: false },
            update = {
              $set: canRunScript
                ? {
                  started: new Date(),
                  state: consts.events.states.processing
                }
                : {
                  start: new Date(Date.now() + rInt(config('events.scriptSaturationDeferDelayMs'), 500))
                },
              $inc: {
                sequence: 1
              }
            },
            result = await Event.collection.findOneAndUpdate(find, update, { returnDocument: 'after', writeConcern: { w: this.#options.writeConcern } }),
            value = decodeME(result && result.value) // clone the whole thing an decode in case of expressions

      if (value) {

        this.#inFlight.add(value)

        Promise
          .resolve(null)
          .then(async() => {

            const { expressions } = modules,
                  org = await Org.loadOrg(value.org),
                  { if: expression } = value,
                  principal = await new Promise((resolve, reject) => {
                    if (!value.principal) {
                      resolve(AccessPrincipal.synthesizeAnonymous(org))
                    } else {
                      AccessPrincipal.create(org, value.principal, (err, principal) => {
                        err ? reject(err) : resolve(principal)
                      })
                    }
                  }),
                  ac = new AccessContext(principal)

            // process conditional expression ----------------------
            if (isSet(expression)) {
              const ec = expressions.createContext(
                ac,
                expression,
                {
                  $$ROOT: value
                }
              )
              if (!(await ec.evaluate())) {
                return { skip: true }
              }
            }

            // process event ---------------------------------------
            switch (value.type) {

              case 'script': {

                {

                  const eventName = value.event,
                        param = value.param,
                        org = await Org.loadOrg(value.org),
                        principal = await new Promise((resolve, reject) => {
                          if (!value.principal) {
                            resolve(AccessPrincipal.synthesizeAnonymous(org))
                          } else {
                            AccessPrincipal.create(org, value.principal, (err, principal) => {
                              err ? reject(err) : resolve(principal)
                            })
                          }
                        }),
                        runtime = await org.getRuntime(),
                        events = toArray(runtime.events).filter(v => v.configuration.event === eventName)

                  if (events.length) {

                    const Model = Event.getModelForType(value.type),
                          subject = new Model(value),
                          context = await promised(
                            subject,
                            'aclRead',
                            new AccessContext(principal, subject, { grant: 'read' })
                          )

                    await promised(
                      null,
                      sandbox.sandboxed(
                        new AccessContext(principal),
                        ` const { Runtime } = require('runtime.event'),                              
                              source = 'event',
                              event = ${JSON.stringify(eventName)},
                              { context, arguments: param } = script
                              
                        Runtime.fire({source, event, params: [param], context})                                              
                      `,
                        {
                          compilerOptions: {
                            label: `Event`,
                            type: 'event',
                            language: 'javascript',
                            specification: 'es6'
                          },
                          scriptOptions: {
                            context
                          },
                          scriptId: doc._id
                        },
                        param
                      ))
                  }

                }

                break

              }

              case 'driver': {

                const userOptions = value.options || {},
                      privilegedOptions = value.privileged && userOptions,
                      org = await Org.loadOrg(value.org),
                      { object: objectName, operation: operationName } = userOptions,
                      object = await org.createObject(objectName),
                      principal = await new Promise((resolve, reject) => {
                        if (!value.principal) {
                          resolve(AccessPrincipal.synthesizeAnonymous(org))
                        } else {
                          AccessPrincipal.create(org, value.principal, (err, principal) => {
                            err ? reject(err) : resolve(principal)
                          })
                        }
                      }),
                      driver = new Driver(principal, object, { })

                await driver.executeOperation(operationName, userOptions, privilegedOptions)

                break

              }

              case 'console': {

                const param = value.param

                if (!(config('app.env') === 'production' && config('app.domain') === 'market')) {

                  roughSizeOfObject(param, 8192)

                  Console.create({
                    org: value.org,
                    date: new Date(),
                    level: 'log',
                    message: serializeObject(param)
                  }, err => {
                    void err
                  })
                }

                break

              }

              case 'notification': {

                const name = value.name,
                      vars = value.variables,
                      variables = isSet(vars) ? vars : {},
                      options = value.options,
                      org = await Org.loadOrg(value.org),
                      principal = await new Promise((resolve, reject) => {
                        if (!value.principal) {
                          resolve(AccessPrincipal.synthesizeAnonymous(org))
                        } else {
                          AccessPrincipal.create(org, value.principal, (err, principal) => {
                            err ? reject(err) : resolve(principal)
                          })
                        }
                      }),
                      ac = new AccessContext(principal),
                      params = isSet(name) ? [name, variables, { ...options, queue: false }] : [variables, { ...options, queue: false }, Undefined]

                await promised(modules.notifications, 'send', ac, ...params)

                break
              }

              default:

            }

          })
          .catch(err => {
            return { err }
          })
          .then(async({ err, skip = false } = {}) => {

            try {

              const { events: { states, retention } } = consts,
                    find = { _id: value._id, state: consts.events.states.processing, reap: false },
                    eventRetention = isSet(value.retention) ? value.retention : retention.never,
                    retainEvent = (skip && ((eventRetention & retention.skipped) === retention.skipped)) || (err && ((eventRetention & retention.failed) === retention.failed)) || (!err && ((eventRetention & retention.completed) === retention.completed)),
                    update = retainEvent
                      ? {
                        $set: {
                          state: skip ? states.skipped : (err ? states.failed : states.completed),
                          err: ((v) => {
                            const err = encodeME(toJSON(Fault.from(v)))
                            if (err && err.stack) {
                              delete err.stack // NEVER include the stack
                            }
                            return err
                          })(err)
                        }
                      }
                      : {
                        $set: {
                          reap: true
                        },
                        $unset: {
                          key: 1
                        }
                      }

              await Event.collection.findOneAndUpdate(find, update, { writeConcern: { w: this.#options.writeConcern } })

            } catch (err) {

              logger.error('[module.events._process#processed]', toJSON(err, { stack: true }))

            }

            if (err) {

              try {

                const ac = new AccessContext(
                        AccessPrincipal.synthesizeAnonymous(
                          await Org.loadOrg(value.org)
                        )
                      ),
                      triggerExists = await promised(sandbox, 'triggerExists', ac.principal, 'system', 'err.events.failed')

                if (triggerExists) {

                  const Model = Event.getModelForType(value.type),
                        subject = new Model(value),
                        context = await promised(
                          subject,
                          'aclRead',
                          new AccessContext(ac.principal, subject, { grant: 'read' })
                        )

                  await promised(
                    sandbox,
                    'triggerScript',
                    'err.events.failed',
                    null,
                    new AccessContext(
                      AccessPrincipal.synthesizeAnonymous(
                        await Org.loadOrg(value.org)
                      )
                    ),
                    {
                      forceInline: true,
                      object: 'system',
                      context
                    },
                    {
                      err: toJSON(err)
                    }
                  )
                }

              } catch (e) {

              }

            }

            this.#numProcessed += 1
            this.#lastProcessed = new Date()
            this.#inFlight.delete(value)

            this.#pollIn = 0
            this.#curPoll = 0

          })

      }

    } catch (err) {

      logger.error('[module.events._process]', toJSON(err, { stack: true }))
    }

  }

  async _expire(doc) {

    try {

      const { Event } = modules.db.models

      await Event.collection.updateOne(
        {
          _id: doc._id,
          reap: false,
          expiresAt: doc.expiresAt
        },
        {
          $set: {
            reap: true
          },
          $unset: {
            key: 1
          }
        }
      )

    } catch (err) {

      logger.error('[module.events._expire]', toJSON(err, { stack: true }))
    }

  }

  async _wait() {

    const { minPoll, maxPoll, pollBackOffScalar } = this.#options

    if (!this.isStarted) {
      return false
    }

    this.#curPoll = Math.min(maxPoll, Math.max(minPoll, this.#curPoll) * pollBackOffScalar)
    this.#pollIn = this.#curPoll
    while (this.#pollIn > 0) {

      await sleep(Math.min(this.#pollIn, minPoll))
      this.#pollIn = Math.max(0, this.#pollIn - minPoll)

      if (!this.isStarted) {
        return false
      }
    }

    return true
  }

}

module.exports = new EventsModule()
