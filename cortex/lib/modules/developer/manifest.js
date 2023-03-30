'use strict'

const privatesAccessor = require('../../classes/privates').createAccessor(),
      { singularize, pluralize } = require('inflection'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      { array: toArray, isSet, rBool, rVal, isCustomName } = require('../../utils')

// Augmented regular expresions. Accepts strings, star
class ARegex {

  constructor(input) {
    let value
    if (_.isString(input)) {
      const match = input.match(/^\/(.*)\/(.*)/)
      value = match ? new RegExp(match[1], match[2]) : input
    }
    if (_.isRegExp(input)) {
      value = input
    }

    Object.assign(privatesAccessor(this), { value })
  }

  test(pattern) {
    const value = privatesAccessor(this, 'value')
    if (_.isString(value)) {
      return value === '*' || _.isEqual(pattern, value)
    }
    if (_.isRegExp(value)) {
      return value.test(pattern)
    }

    return false
  }

}

// Basic matching stage
class ManifestStage {

  constructor(input, { implicitStar = true, defaults = { dependencies: true, importOwner: null, exportOwner: null } } = {}) {
    const definition = input || {}

    if (!definition.includes && implicitStar) {
      definition.includes = ['*']
    }

    Object.assign(privatesAccessor(this), {
      dependencies: rBool(definition.dependencies, defaults.dependencies),
      importOwner: rVal(definition.importOwner, defaults.importOwner),
      exportOwner: rVal(definition.exportOwner, defaults.exportOwner),
      includes: toArray(definition.includes || [], true).map(v => new ARegex(v)),
      excludes: toArray(definition.excludes || [], true).map(v => new ARegex(v)),
      defer: toArray(definition.defer || [], true).map(v => new ARegex(v))
    })
  }

  get includes() {
    return privatesAccessor(this, 'includes')
  }

  get excludes() {
    return privatesAccessor(this, 'excludes')
  }

  get defer() {
    return privatesAccessor(this, 'defer')
  }

  get dependencies() {
    return privatesAccessor(this, 'dependencies')
  }

  get importOwner() {
    return privatesAccessor(this, 'importOwner')
  }

  get exportOwner() {
    return privatesAccessor(this, 'exportOwner')
  }

  getImportOwner(path) {
    return this.importOwner
  }

  getExportOwner(path) {
    return this.exportOwner
  }

  shouldIncludeDependencies() {
    return this.dependencies
  }

  accept(path) {
    return (this.includes.some(r => r.test(path))) &&
      !this.excludes.some(r => r.test(path))
  }

  shouldDefer(path) {
    return (this.defer.some(r => r.test(path)))
  }

}

class ObjectSection extends ManifestStage {

  constructor(def, key) {
    super(def)

    if (!def[key]) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: `The ${key} is missing from the manifest descriptor.` })
    }

    Object.assign(privatesAccessor(this), {
      key,
      keyTester: new ARegex(def[key])
    })
  }

  accept(path) {

    const keyTester = privatesAccessor(this, 'keyTester'),
          [first, ...rest] = path.split('.')

    if (keyTester) {

      return keyTester.test(first) &&
          (!rest.length || super.accept(rest.join('.')))
    }
    return false

  }

}

class Manifest extends ManifestStage {

  constructor(input) {

    const def = input || {},
          thisStages = {},
          implicitStar = !Object.keys(def).length || (def.includes || [])[0] === '*',
          builtInSections = Manifest.builtInSections

    super(def, { implicitStar, defaults: { dependencies: true, importOwner: null, exportOwner: null } })

    if (def.objects) {
      thisStages.objects = toArray(def.objects, true).map(section => new ObjectSection(section, 'name'))
    }

    // If manifest is not provided we need to override the objects export to include everything
    if (implicitStar) {
      builtInSections.push('objects')
    }

    // We define a section for each built-in name
    builtInSections.forEach((name) => {
      if (def[name] || implicitStar) {
        thisStages[name] = new ManifestStage(def[name], { defaults: { dependencies: this.dependencies, importOwner: this.importOwner, exportOwner: this.exportOwner } })
      }
    })

    // We also define a section for each custom name to capture user data
    Object.keys(def)
      .filter(v => isCustomName(v))
      .forEach((name) => {
        if (def[name]) {
          thisStages[name] = new ManifestStage(def[name], { defaults: { dependencies: this.dependencies, importOwner: this.importOwner, exportOwner: this.exportOwner } })
          Object.defineProperty(this, name, {
            get: () => privatesAccessor(this, name)
          })
        }
      })

    Object.assign(privatesAccessor(this), { thisStages })
  }

  static get builtInSections() {
    return [
      'env',
      'configs',
      'i18ns',
      'scripts', 'views', 'templates', 'expressions', 'idps',
      'apps', 'roles', 'serviceAccounts', 'smsNumbers', 'policies', 'notifications', 'storageLocations']
  }

  has(stage) {

    const { thisStages } = privatesAccessor(this)
    return isSet(thisStages[String(stage === 'env' || isCustomName(stage) ? stage : pluralize(stage))])
  }

  accept(path) {
    // Global include/exclude works on the last item of the path
    const { thisStages } = privatesAccessor(this),
          [last] = path.split('.').reverse(),
          [first, ...rest] = path.split('.')

    // dispatch acceptance to appropriate section
    if (thisStages[first]) {
      return _.isArray(thisStages[first])
        ? thisStages[first].some(section => section.accept(rest.join('.')))
        : thisStages[first].accept(rest.join('.'))
    }

    return this.includes.some(r => r.test(last)) &&
      !this.excludes.some(r => r.test(last))
  }

  shouldIncludeDependencies(path) {
    const { thisStages } = privatesAccessor(this),
          [head, ...tail] = path.split('.'),
          singular = singularize(head),
          plural = pluralize(head)

    if (tail.length) {
      const names = singular === plural ? [singular] : [singular, plural],
            test = tail.join('.')
      for (let name of names) {
        const stage = thisStages[name]
        if (stage && stage instanceof ManifestStage) {
          const result = stage.shouldIncludeDependencies(test)
          if (isSet(result)) {
            return result
          }
        }
      }
    }
    return this.dependencies
  }

  shouldDefer(path) {
    const { thisStages } = privatesAccessor(this),
          [head, ...tail] = path.split('.'),
          singular = singularize(head),
          plural = pluralize(head)

    if (tail.length) {
      const names = singular === plural ? [singular] : [singular, plural],
            test = tail.join('.')
      for (let name of names) {
        const stage = thisStages[name]
        if (stage && stage instanceof ManifestStage) {
          const result = stage.shouldDefer(test)
          if (isSet(result)) {
            return result
          }
        }
      }
    }
    return false
  }

  getImportOwner(path) {
    const { thisStages } = privatesAccessor(this),
          [head, ...tail] = path.split('.'),
          singular = singularize(head),
          plural = pluralize(head)
    if (tail.length) {
      const names = singular === plural ? [singular] : [singular, plural]
      for (let name of names) {
        const stage = thisStages[name]
        if (stage && stage instanceof ManifestStage) {
          const result = stage.getImportOwner(path)
          if (isSet(result)) {
            return result
          }
        }
      }
    }
    return null
  }

  getExportOwner(path) {
    const { thisStages } = privatesAccessor(this),
          [head, ...tail] = path.split('.'),
          singular = singularize(head),
          plural = pluralize(head)
    if (tail.length) {
      const names = singular === plural ? [singular] : [singular, plural]
      for (let name of names) {
        const stage = thisStages[name]
        if (stage && stage instanceof ManifestStage) {
          const result = stage.getExportOwner(path)
          if (isSet(result)) {
            return result
          }
        }
      }
    }
    return null
  }

  [Symbol.iterator]() {

    const { thisStages } = privatesAccessor(this),
          keys = Object.keys(thisStages).sort().reverse()

    return {
      next: () => {
        if (keys.length === 0) {
          return { done: true }
        }
        const key = keys.pop()
        return { value: { name: key, stage: thisStages[key] }, done: false }
      }
    }

  }

  get env() {
    return privatesAccessor(this, 'env')
  }

  get configs() {
    return privatesAccessor(this, 'configs')
  }

  get objects() {
    return privatesAccessor(this, 'objects')
  }

  get scripts() {
    return privatesAccessor(this, 'scripts')
  }

  get expressions() {
    return privatesAccessor(this, 'expressions')
  }

  get idps() {
    return privatesAccessor(this, 'idps')
  }

  get views() {
    return privatesAccessor(this, 'views')
  }

  get templates() {
    return privatesAccessor(this, 'templates')
  }

  get apps() {
    return privatesAccessor(this, 'apps')
  }

  get roles() {
    return privatesAccessor(this, 'roles')
  }

  get serviceAccounts() {
    return privatesAccessor(this, 'serviceAccounts')
  }

  get policies() {
    return privatesAccessor(this, 'policies')
  }

  get notifications() {
    return privatesAccessor(this, 'notifications')
  }

  get storageLocations() {
    return privatesAccessor(this, 'storageLocations')
  }

}

module.exports = { Manifest, ARegex }
