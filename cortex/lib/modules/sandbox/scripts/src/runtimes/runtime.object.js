/* global script, cortexify, Fault, CortexObject, consts */

const pPrivates = Symbol('objectPrivates'),
      runtimes = new Map(),
      objects = {},
      {
        rNum, array: toArray, rBool, rString, matchesEnvironment
      } = require('util.values'),
      { equalIds } = require('util.id'),
      { singularize } = require('inflection')

module.exports = {

  Runtime: class ObjectRuntime {

    constructor(objectClass, objectName, options) {

      CortexObject.forgetObject(objectName)

      options = options || {}

      this[pPrivates] = {
        objectClass,
        objectName: String(singularize(objectName)).toLowerCase().trim(),
        environment: rString(options.environment, '*'),
        active: rBool(options.active, true),
        weight: rNum(options.weight, 0)
      }

    }

    get objectClass() {
      return this[pPrivates].objectClass
    }

    get objectName() {
      return this[pPrivates].objectName
    }

    get objectWeight() {
      return this[pPrivates].weight
    }

    get objectActive() {
      return this[pPrivates].active
    }

    get objectEnvironment() {
      return this[pPrivates].environment
    }

    get isAvailable() {
      const { active, environment } = this[pPrivates]
      return !!(active && matchesEnvironment(environment))
    }

    static getObjectClass(name) {

      const { runtime = {} } = global && global.env,
            runtimeObject = toArray(runtime.objects).find((v) => v.name === name),
            {
              metadata: {
                resource, scriptExport, className, loc: { line = '?', column = '?' } = {}
              } = {}, weight
            } = runtimeObject || {}

      let Candidate,
          RuntimeCandidate

      // allow class to be defined anonymously and override registered objects
      if (equalIds(script._id, consts.emptyId)) {
        for (const runtime of runtimes.values()) {
          const { objectName, objectWeight } = runtime
          if (objectName === name) {
            if (!RuntimeCandidate || objectWeight > RuntimeCandidate.objectWeight) {
              RuntimeCandidate = runtime
            }
          }
        }
      }

      // load the script, which triggers runtime registration so we can discover the class
      if (runtimeObject) {
        try {
          require(scriptExport)
        } catch (err) {
          try {
            err.resource = resource
          } catch (e) {
            void e
          }
          throw err
        }
        for (const runtime of runtimes.values()) {
          const { objectClass, objectName, objectWeight } = runtime
          if (!Candidate && objectName === name && objectWeight === weight && className === objectClass.name) {
            Candidate = runtime
          }
        }

      }

      if (RuntimeCandidate) {
        if (!Candidate || RuntimeCandidate.objectWeight > Candidate.objectWeight) {
          Candidate = RuntimeCandidate
        }
      }

      if (Candidate) {
        if (!(Candidate.objectClass.prototype instanceof CortexObject)) {
          throw Fault.create('script.invalidArgument.unspecified', { reason: `Class "${className}" in script.export(${scriptExport}).@object ${line}:${column} must extend CortexObject` })
        } else {
          cortexify(Candidate.objectClass)
          objects[name] = Candidate.objectClass
        }

      }

      return Candidate && Candidate.objectClass

    }

    static initialize(Class, name, options) {

      if (!runtimes.has(Class)) {

        const runtime = new ObjectRuntime(Class, name, options)

        if (runtime.isAvailable) {
          runtimes.set(
            Class, runtime
          )

          try {
            const { objectClass, objectName } = runtime
            Object.defineProperty(
              objectClass,
              'objectName',
              {
                value: objectName,
                enumerable: true,
                configurable: false
              }
            )
          } catch (err) {
            throw err
          }
        }
      }

    }

  }
}
