'use strict'

const Fault = require('cortex-service/lib/fault'),
      LinkedList = require('cortex-service/lib/linked-list'),
      clone = require('clone'),
      _ = require('underscore'),
      { EventEmitter } = require('events'),
      modules = require('..'),
      uuid = require('uuid'),
      ap = require('../../access-principal'),
      acl = require('../../acl'),
      consts = require('../../consts'),
      modulePrivates = require('../../classes/privates').createAccessor(),
      { pluralize } = require('inflection'),
      { Manifest } = require('./manifest'),
      { OutputStream } = require('../../classes/chunk-stream'),
      { ResourceCache } = require('./resource-cache'),
      {
        findIdInArray, getIdOrNull, equalIds, couldBeId, sortKeys, promised, rBool, sleep,
        path: pathTo, joinPaths, isPlainObject, naturalCmp, array: toArray, pathParts,
        pathSuffix, option: getOption, isPlainObjectWithSubstance, clamp, rInt,
        isCustomName, resolveOptionsCallback
      } = require('../../utils'),
      builtInRoleCodes = Object.values(consts.defaultRoles).map(v => v.code),
      MAX_IMPORT_DEPTH = 20

let Undefined

class ResourceLL extends LinkedList {

  constructor(compare = () => 0) {
    super()
    this.compare = compare
  }

  find(fn) {
    if (this.first) {
      let n = null, idx = 0
      while (n !== this.last) {
        n = n ? n.next : this.first
        if (fn(n, idx++)) return n
      }
    }
    return Undefined
  }

  insert({ path, callback }) {
    let node = this.first
    while (node !== this.last) {
      if (this.compare(node.value.path, path) > 0) {
        return this.insertBefore(node, { path, callback })
      }
      node = node.next
    }
    if (this.last && this.compare(this.last.value.path, path) > 0) {
      return this.insertBefore(this.last, { path, callback })
    }
    return this.push({ path, callback })
  }

}

class ResourceGroup extends ResourceLL {

  findPath(path) {
    return this.find(v => v.value.path === path)
  }

}

class ResourceGroups extends ResourceLL {

  constructor(compare) {
    super(compare)
    Object.assign(modulePrivates(this), {
      map: new Map()
    })
  }

  addGroup(name = '', compare = () => 0) {
    const { map } = modulePrivates(this)
    let group = map.get(name)
    if (!map.has(name)) {
      group = new ResourceGroup(compare)
      map.set(name, group)
      this.push(group)
    }
    return group
  }

  get totalLength() {
    return this.reduce((length, group) => length + group.value.length, 0)
  }

  getGroup(name = '') {
    return modulePrivates(this).map.get(name)
  }

  /**
   * push a resource name if it does not exist.
   * @param groupName
   * @param path
   * @param options { force, payload }
   * @param callback a callback to use instead of the group importer
   */
  pushPath(groupName, path, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback, false, true)

    const group = this.addGroup(groupName)
    if (options.force || !group.findPath(path)) {
      group.push(Object.assign({}, options.payload || {}, { path, callback }))
    }
  }

  /**
   * insert a resource name if it does not exist (sorted)
   * @param path
   * @param groupName
   * @param callback a callback to use instead of the group importer
   */
  insertPath(groupName, path, callback) {
    const group = this.addGroup(groupName)
    if (!group.findPath(path)) {
      group.insert({ path, callback })
    }
  }

}

class ResourceStream extends EventEmitter {

  /**
   * @param ac
   * @param input
   *  sortKeys: true
   *  preferUrls: true
   *  silent: false
   *  maxResources
   *  manifest: undefined (can be set later)
   *  manifestType : 'exports'  ['exports', 'imports']
   *  disableTriggers: false
   */
  constructor(ac, input) {

    super()

    const options = input || {},
          privates = modulePrivates(this)

    Object.assign(privates, {
      ac,
      maxResources: clamp(rInt(options.maxResources, 10000), 1, 10000),
      cache: new ResourceCache({
        maxResources: options.maxResources,
        cacheKey: options.cacheKey,
        cacheTtl: clamp(rInt(options.cacheTtl, 3600), 60, 3600)
      }),
      silent: rBool(options.silent, false),
      sortKeys: rBool(options.sortKeys, true) ? sortKeys : (v) => v,
      preferUrls: rBool(options.preferUrls, true),
      disableTriggers: rBool(options.disableTriggers, false),
      importTotal: 0,
      added: new Set(),
      exported: new Set(),
      dependencies: {},
      environment: {
        ac: null,
        depth: 0
      },
      importDepth: 0,
      groups: new ResourceGroups(options.groupCompare),
      facetQueue: [], // buffered facet objects. flushed at the end of exports to send media.
      deferredMediaTriggers: new Map(),
      manifestType: options.manifestType === 'imports' ? 'imports' : 'exports'
    })

    if (options.manifest !== Undefined) {
      this.manifest = options.manifest
    }

  }

  async beginEnvironmentUpdate({ deferSyncEnvironment = true, isImport = true } = {}) {

    const privates = modulePrivates(this),
          { environment, ac: { req, script, principal: { orgId, email }, org: currentOrg } } = privates,
          { ac, depth } = environment

    if (!ac && depth !== 0) {
      throw Fault.create('cortex.error.unspecified', { reason: 'Inconsistent environment state' })
    } else if (ac && depth === 0) {
      throw Fault.create('cortex.error.unspecified', { reason: 'Inconsistent environment state' })
    } else if (depth === 0) {

      const model = await promised(currentOrg, 'createObject', 'org'),
            org = await promised(model, 'loadOrg', orgId, { cache: false })

      environment.ac = new acl.AccessContext(
        await ap.create(org, email),
        org,
        { req, script, passive: true, options: { deferSyncEnvironment, isImport } }
      )
    }

    environment.depth += 1
    return environment.ac

  }

  async updateEnvironment(asyncHandler, options = {}) {

    let result = Undefined
    await promised(modules.db, 'sequencedFunction', (callback) => {
      Promise.resolve(null)
        .then(async() => {
          const ac = await this.beginEnvironmentUpdate(options)
          result = await asyncHandler(ac)
          await this.endEnvironmentUpdate(options)
        })
        .then(() => callback())
        .catch(err => callback(err))
    })
    return result
  }

  async endEnvironmentUpdate({ disableTriggers = this.disableTriggers } = {}) {

    const privates = modulePrivates(this),
          { environment, ac } = privates

    if (environment.depth === 0) {
      throw Fault.create('cortex.error.unspecified', { reason: 'Inconsistent environment state' })
    } else if (!environment.ac) {
      throw Fault.create('cortex.error.unspecified', { reason: 'Inconsistent environment state' })
    }

    environment.depth -= 1

    if (environment.depth === 0) {
      const eac = environment.ac
      environment.ac = null
      await promised(eac, 'save', { disableTriggers })
      ac.updateOrg(eac.subject)
    }

    return environment.depth === 0

  }

  get cache() {
    return modulePrivates(this).cache
  }

  get silent() {
    return modulePrivates(this).silent
  }

  get disableTriggers() {
    return modulePrivates(this).disableTriggers
  }

  addResourceGroup(group, compare) {
    modulePrivates(this).groups.addGroup(group, compare)
  }

  async addResource(resourceName, group = 'default', sorted = false, doc = null, asyncCallback = null, identifierPaths = []) {

    const privates = modulePrivates(this),
          { groups } = privates

    sorted
      ? groups.insertPath(group, resourceName, asyncCallback)
      : groups.pushPath(group, resourceName, asyncCallback)

    if (doc) {

      privates.importTotal++

      delete doc._id // cannot start with an _id or conflicts may arise
      await this.cache.cacheResource(doc, group, identifierPaths)
    }

  }

  log(type, resource = {}, level = 'info', object = 'manifest.log') {

    this.emit('resource', sortKeys({ timestamp: new Date(), type, level, ...resource, object }))

  }

  /**
   * if the import returns false, the loop stops.
   *
   * @param ac
   * @param groupName
   * @param importer
   * @returns {Promise<boolean>}
   */
  async importResourceGroup(ac, groupName, importer) {

    const privates = modulePrivates(this),
          { groups } = privates,
          group = groups.getGroup(groupName)

    if (privates.currentGroup) {
      throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Sorry. importResourceGroup() is not re-entrant.' })
    }

    if (group) {

      this.log('import.group', { groupName })

      privates.currentGroup = groupName
      while (group.length) {

        if (this.err) {
          throw this.err
        }

        const node = group.shift(),
              deferred = node.value.deferred,
              handler = node.value.callback || importer,
              progress = parseFloat((100 - ((groups.totalLength / (privates.importTotal || 1)) * 100)).toFixed(2))

        this.log(`import.${deferred ? 'deferred' : 'resource'}`, { resource: node.value.path, progress })

        let result = await handler(ac, node.value.path)

        if (result === false) {
          return false
        }

      }
      privates.currentGroup = null
    }

  }

  /**
   * Add a resource back into it's resource group to be processed again.
   *
   * @param resourcePath
   * @param asyncCallback
   */
  deferResource(resourcePath, asyncCallback) {

    const privates = modulePrivates(this),
          { groups, currentGroup } = privates

    this.log('import.defer', { resource: resourcePath })

    groups.pushPath(currentGroup, resourcePath, { force: true, payload: { deferred: true } }, asyncCallback)

  }

  // add a path before the actual resource. this 2 stage process prevents circular dependency inclusion.
  /**
   * @param resourcePath
   * @param parentResource
   * @param options
   *  required
   * @returns {boolean}
   */
  addPath(resourcePath, parentResource, options) {

    const { added, dependencies } = modulePrivates(this),
          required = getOption(options, 'required'),
          // required = parentResource && this.includeDependencies(parentResource),
          wasAdded = this.wasAdded(resourcePath)

    if (this.accept(resourcePath) || required) {

      // always track dependency includes so they go both ways in case 1 object requires something that has already been added.
      if (parentResource) {

        let obj = dependencies[resourcePath]
        if (!obj) {
          dependencies[resourcePath] = {}
        }
        dependencies[resourcePath].requiredBy = _.uniq(toArray(dependencies[resourcePath].requiredBy).concat(parentResource)).sort(naturalCmp)

        obj = dependencies[parentResource]
        if (!obj) {
          dependencies[parentResource] = {}
        }
        dependencies[parentResource].requires = _.uniq(toArray(dependencies[parentResource].requires).concat(resourcePath)).sort(naturalCmp)
      }

      // return true if it was added. this prevents circular inclusion
      added.add(resourcePath)

      return !wasAdded
    }

    return false

  }

  async flushFacetQueue() {

    const { facetQueue, preferUrls } = modulePrivates(this)

    for (const { ac, facet, resourceId, parentPath, pointer } of facetQueue) {

      if (this.err) {
        throw this.err
      }

      const chunkSize = 8192,
            { sortKeys, exported } = modulePrivates(this),
            resourcePath = `${parentPath}.${facet.name}`,
            resource = {
              ETag: facet.ETag,
              mime: facet.mime,
              name: facet.name,
              object: 'facet',
              resourceId
            }

      if (!this.addPath(resourcePath, parentPath, { required: true })) {
        return Undefined
      }

      if (!exported.has(resourcePath)) {

        exported.add(resourcePath)

        let err = null, url = null, sz = null

        if (preferUrls) {
          try {
            url = await promised(modules.streams, 'getPointerUrl', ac, pointer)
          } catch (e) {
            err = e
          }
        }
        try {
          sz = await promised(pointer, 'getSize')
        } catch (e) {
          err = err || e
        }

        // path / url / base64 / streamId
        if (url) {

          // prefer sending an url, since the client will likely check ETags before downloading.
          resource.url = url.url

        } else if (sz === null) {

          // failed to get anything. most likely the file is missing.
          // we could fallback to api path and let the client handle the error, but
          // it's probably better to quit here.
          if (err) {
            err = Fault.from(err)
            err.path = resourcePath
            throw err
          }

          resource.path = facet.path

        } else if (sz <= chunkSize) {

          // send small files as base64 data.
          try {
            const bufferPointer = new modules.storage.BufferPointer(null, {}, ac)
            await promised(bufferPointer, 'write', pointer)
            resource.base64 = bufferPointer.buffer.toString('base64')
          } catch (e) {
            err = Fault.from(e)
            err.path = resourcePath
            throw err
          }

        } else {

          resource.streamId = uuid.v4()

        }

        this.emit('resource', sortKeys({ ...resource, resource: resourcePath }), resourcePath)

        // attempt to stream
        if (resource.streamId) {

          const chunked = new OutputStream({
            chunkSize,
            template: {
              object: 'stream',
              streamId: resource.streamId
            },
            ndjson: false
          })

          let stream

          try {
            stream = await promised(pointer, 'stream')
          } catch (e) {
            err = Fault.from(err || e)
            err.path = resourcePath
            throw err
          }

          stream.pipe(chunked)

          await new Promise((resolve, reject) => {

            chunked
              .on('data', (chunk) => {

                if (this.err) {
                  try {
                    stream.destroy(this.err)
                  } catch (err) {
                    void err
                  }
                }

                this.emit('resource', chunk, resourcePath)
              })
              .on('error', (err) => {
                reject(err)
              })
              .on('end', () => {
                resolve()
              })
          })

        }

      }

    }

  }

  queueFacet(ac, facet, resourceId, parentPath, pointer) {

    const { facetQueue } = modulePrivates(this)

    facetQueue.push({ ac, facet, resourceId, parentPath, pointer })

  }

  // add a resource to the manifest. it can't be exported unless the path was added.
  exportResource(resource, resourcePath, { excludeFromExports = false } = {}) {

    void this.manifest

    const { exported, maxResources, sortKeys } = modulePrivates(this)

    if (this.wasAdded(resourcePath)) {

      // acknowledge the addition
      if (!exported.has(resourcePath)) {

        if (exported.size > maxResources) {
          throw Fault.create('cortex.accessDenied.unspecified', {
            reason: `The maximum number of resources (${maxResources}) has been reached.`,
            path: resourcePath
          })
        }

        // write element to internal representation of the manifest
        // do not write facets.
        if (this.writable) {
          const [prefix, suffix] = pathParts(resourcePath),
                { document } = modulePrivates(this)

          if (prefix === 'env') {
            if (!document['env']) {
              document['env'] = {
                includes: ['*']
              }
            }
          } else if (prefix !== 'facet' && prefix && suffix) {
            if (prefix === 'object') {
              const [objectName] = pathParts(suffix)
              document.objects = toArray(document.objects)
              let object = document.objects.find(v => v.name === objectName)
              if (!object) {
                object = {
                  name: objectName,
                  includes: ['*']
                }
                document.objects.push(object)
                document.objects.sort((a, b) => naturalCmp(a.name, b.name))
              }
            } else {
              const pluralName = pluralize(prefix)
              if (!document[pluralName]) {
                document[pluralName] = {
                  includes: []
                }
              }
              document[pluralName].includes = document[pluralName].includes.concat(suffix).sort(naturalCmp)
            }
          }
        }
        if (!excludeFromExports) {
          exported.add(resourcePath)
        }

        this.emit('resource', sortKeys({ ...resource, resource: resourcePath }), resourcePath)
      }

    } else {
      throw Fault.create('cortex.invalidArgument.unspecified', {
        reason: `Adding a resource without first adding it to the manifest is not allowed`,
        resource: resourcePath,
        path: resourcePath
      })
    }

    return resource

  }

  get manifest() {

    let { manifest } = modulePrivates(this)

    if (manifest) {
      return manifest
    }

    this.manifest = null // trigger creation.
    return modulePrivates(this).manifest

  }

  set manifest(manifest) {

    const writable = !isPlainObjectWithSubstance(manifest),
          document = (writable ? {} : clone(manifest)) || {},
          privates = modulePrivates(this)

    if (privates.manifest && (privates.exported.size || privates.added.size)) {
      throw Fault.create('cortex.invalidArgument.unspecified', {
        reason: `Duplicate manifest detected. The manifest has already been set and resources have been added.`
      })
    }

    Object.assign(privates, {
      manifest: new Manifest(clone(document)),
      document,
      writable
    })

  }

  get writable() {

    void this.manifest
    return modulePrivates(this).writable

  }

  accept(resourcePath) {

    if (this.err) {
      return false
    }

    const [first, ...last] = resourcePath.split('.')

    return this.manifest.accept(
      [
        first === 'env' || isCustomName(first) ? first : pluralize(first),
        ...last
      ].join('.')
    )
  }

  // if true, try to follow and export dependencies
  includeDependencies(resourcePath) {
    return this.manifest.shouldIncludeDependencies(resourcePath)
  }

  // true if the resource was added using addPath.
  wasAdded(path) {
    const { added } = modulePrivates(this)
    return added.has(path)
  }

  get document() {
    const { sortKeys, document = {} } = modulePrivates(this)
    return sortKeys(document)
  }

  get exports() {
    const { exported } = modulePrivates(this)
    return Array.from(exported).sort(naturalCmp)
  }

  get dependencies() {
    const { sortKeys, dependencies } = modulePrivates(this)
    return sortKeys(dependencies)
  }

  async end(err) {

    if (err && !this.err) {
      this.err = err
    }

    if (!err) {

      void this.manifest

      const { document, exported, dependencies, sortKeys, manifestType } = modulePrivates(this)

      this.emit('resource', sortKeys(Object.assign(document, {
        object: 'manifest'
      }), true))

      this.emit('resource', sortKeys({
        object: 'manifest-dependencies',
        dependencies: sortKeys(dependencies)
      }, true))

      this.emit('resource', sortKeys({
        object: `manifest-${manifestType}`,
        resources: Array.from(exported).sort(naturalCmp)
      }, true))

    }

    // cancel active uploads.
    try {
      await this.cache.cancelUploads()
    } catch (e) {
    }

    // clear uploads
    const { ac: { principal } } = modulePrivates(this),
          { Upload } = modules.db.models,
          facets = await this.cache.listKeys('facet')

    for (const facetKey of facets) {
      try {
        const { uploadId } = (await promised(modules.cache, 'get', null, facetKey)) || {}
        if (uploadId) {
          await promised(Upload, 'aclDelete', principal, uploadId, { override: true })
        }
      } catch (err) {
      }
    }

    try {
      await this.cache.clear()
    } catch (e) {
    }

    if (err) {
      this.emit('error', err)
    } else {
      this.emit('end')
    }

  }

  async hasIdentifier(resourceName) {

    const resource = await this.cache.lookupResource({ key: this.cache.getCacheKey(resourceName) })
    return resource && !!resource.identifier
  }

  async importMappedTemplate(ac, name, type, resourcePath) {

    let doc, cached

    const resourceName = `template.${type}.${name}`,
          templateModel = modules.db.models.template

    cached = await this.cache.lookupResource({ key: this.cache.getCacheKey(resourceName) })

    if (cached) {
      if (cached.identifier) {
        doc = cached.lookup
      } else {

        this.log('import.dependency', { resource: resourceName })

        cached = await this.cache.getResource(resourceName)
        doc = await templateModel.schema.node.import(ac, cached.doc, this, resourcePath, { required: true })
        if (doc) {
          await cached.setImportIdentifier(doc._id, { name, type })
        }
      }
    }

    if (!doc) {
      const cursor = await promised(templateModel, 'aclCursor', ac.principal, { resourcePath, name, type, specOnly: true })
      doc = await promised(cursor, 'next')
    }
    if (!doc) {
      throw Fault.create('cortex.notFound.unspecified', {
        reason: `A template dependency "${name}" is missing for ${resourcePath}`,
        path: resourcePath,
        resource: resourcePath
      })
    }
    return doc

  }

  async addMappedTemplate(ac, name, type, resourcePath, options = {}) {

    const includeResourcePrefix = rBool(options.includeResourcePrefix, false),
          mapped = joinPaths(includeResourcePrefix && 'template', name)

    if (this.includeDependencies(resourcePath)) {

      const model = modules.db.models.template,
            cursor = await promised(model, 'aclCursor', ac.principal, { resourcePath, name, type })

      while (await promised(cursor, 'hasNext')) {
        await model.schema.node.export(
          ac,
          await promised(cursor, 'next'),
          this,
          resourcePath,
          { required: true }
        )
      }

    }

    return mapped

  }

  async importMappedObject(ac, objectName, resourcePath) {

    let doc, cached

    const objectModel = modules.db.models.object

    cached = await this.cache.lookupResource({ key: this.cache.getCacheKey(`object.${objectName}`) })

    if (cached) {
      if (cached.identifier) {
        doc = cached.lookup
      } else {
        cached = await this.cache.getResource(`object.${objectName}`)
        doc = await objectModel.schema.node.import(ac, cached.doc, this, resourcePath, { required: true })
        if (doc) {
          await cached.setImportIdentifier(doc._id, { name: doc.name })
        }
      }
    }

    if (!doc) {
      doc = await promised(objectModel, 'aclReadOne', ac.principal, null, {
        allowNullSubject: true,
        throwNotFound: false,
        resourcePath,
        where: { name: objectName },
        paths: ['_id', 'name']
      })
    }
    if (!doc) {
      const nativeId = consts.NativeIds[objectName]
      if (nativeId) {
        doc = {
          _id: nativeId,
          name: objectName
        }
      }
    }
    if (!doc) {

      throw Fault.create('cortex.notFound.unspecified', {
        reason: `An object dependency "${objectName}" is missing for ${resourcePath}`,
        path: resourcePath,
        resource: resourcePath
      })
    }
    return doc

  }

  async addMappedObject(ac, objectName, resourcePath, options = {}) {

    const includeResourcePrefix = rBool(options.includeResourcePrefix, false)
    let model, mapped

    try {
      model = await promised(ac.org, 'createObject', objectName)
    } catch (err) {
      throw Fault.create('cortex.error.unspecified', {
        reason: 'There was a problem loading a resource dependency.',
        resource: resourcePath,
        path: resourcePath
      })
    }

    mapped = joinPaths(includeResourcePrefix && 'object', model.objectName)

    if (this.includeDependencies(resourcePath)) {

      // on custom objects can be added as dependencies. ignore the rest.
      if ((!model.isNative || model.isExtension)) {

        const objectModel = modules.db.models.object,
              doc = (model.isExtensible || !model.isNative)
                ? await promised(objectModel, 'aclReadOne', ac.principal, null, {
                  allowNullSubject: true,
                  resourcePath,
                  where: { name: model.objectName },
                  include: ['locales']
                })
                : null

        if (doc) {
          await objectModel.schema.node.export(
            ac,
            doc,
            this,
            resourcePath,
            { required: true }
          )
        }
      }

    }

    if (this.includeDependencies(resourcePath) && !this.wasAdded(mapped)) {

      // on custom objects can be added as dependencies. ignore the rest.
      if ((!model.isNative || model.isExtension)) {

        if (!this.accept(mapped)) {
          // this is a conflict. @todo some options to handle?
        }

        const objectModel = modules.db.models.object,
              doc = (model.isExtensible || !model.isNative)
                ? await promised(objectModel, 'aclReadOne', ac.principal, null, {
                  allowNullSubject: true,
                  where: { name: model.objectName }
                })
                : null

        if (doc) {
          await objectModel.schema.node.export(
            ac,
            doc,
            this,
            resourcePath,
            { required: true }
          )
        }
      }

    }

    return mapped

  }

  async importMappedInstance(ac, objectName, identifier, resourcePath) {

    let model, doc, search, lookup, cached

    modulePrivates(this).importDepth += 1

    try {

      if (modulePrivates(this).importDepth > MAX_IMPORT_DEPTH) {
        throw Fault.create('cortex.invalidArgument.circularReference', {
          reason: `Import depth exceeded maximum level of recursion (${MAX_IMPORT_DEPTH}). An unhandled circular reference may be present.`,
          resource: resourcePath,
          path: resourcePath
        })
      }

      // These are virtual objects with no importable object definitions.
      if (['serviceAccount', 'role'].includes(objectName)) {
        return this.importMappedPrincipal(ac, `${objectName}.${identifier}`, resourcePath)
      }

      await this.importMappedObject(ac, objectName, resourcePath)

      try {
        model = await promised(ac.org, 'createObject', objectName)
      } catch (err) {
        throw Fault.create('cortex.notFound.unspecified', {
          reason: `An object dependency "${objectName}" failed to load for ${resourcePath}`,
          resource: resourcePath,
          path: resourcePath
        })
      }

      if (model.objectName === 'org') {

        doc = { _id: ac.org._id, code: ac.org.code }

      } else if (model.objectName === 'account') {

        return this.importMappedPrincipal(ac, `account.${identifier}`, resourcePath)

      } else if (model.objectName === 'object') {

        return this.importMappedObject(ac, objectName, resourcePath)

      } else if (!model.uniqueKey) {

        throw Fault.create('cortex.invalidArgument.unspecified', {
          reason: `This object cannot be imported unless the uniqueKey is set`,
          resource: resourcePath,
          path: resourcePath
        })

      }

      if (isPlainObject(identifier)) {
        search = identifier
        lookup = {
          // add val.lookup prefix
          ...Object.keys(identifier)
            .reduce(
              (m, k) => Object.assign(m, { [`val.lookup.${k}`]: identifier[k] }), {}
            ),
          key: new RegExp(`^${RegExp.escape(this.cache.getCacheKey(objectName))}`) // startsWith to narrow down
        }
      } else {
        lookup = { key: this.cache.getCacheKey(`${objectName}.${identifier}`) }
        search = { [model.uniqueKey]: identifier }
      }

      cached = await this.cache.lookupResource(lookup)
      if (cached) {
        if (cached.identifier) {
          doc = cached.lookup
        } else {
          this.log('import.dependency', { resource: cached.resourcePath })
          cached = await this.cache.getResource(cached.resourcePath)
          doc = await model.schema.node.import(ac, cached.doc, this, resourcePath, { required: true })
          if (doc) {
            await cached.setImportIdentifier(doc._id, { [model.uniqueKey]: cached.doc[model.uniqueKey] })
          }
        }
      }

      if (!doc) {
        doc = await promised(model, 'aclReadOne', ac.principal, null, {
          allowNullSubject: true,
          throwNotFound: false,
          where: search,
          paths: ['_id', model.uniqueKey]
        })
      }
      if (!doc) {

        let notFound = identifier
        try {
          if (search[model.uniqueKey] === identifier) {
            notFound = identifier
          } else if (isPlainObject(identifier)) {
            notFound = JSON.stringify(identifier)
          } else {
            notFound = String(identifier)
          }
        } catch (e) {
          void e
        }

        throw Fault.create('cortex.notFound.unspecified', {
          reason: `An instance dependency "${joinPaths(objectName, notFound)}" is missing for ${resourcePath}`,
          resource: resourcePath,
          path: resourcePath
        })
      }
      return doc

    } finally {

      modulePrivates(this).importDepth -= 1

    }

  }

  async addMappedInstance(ac, objectName, identifier, resourcePath, options = {}) {

    let model, mapped, searchOptions = {}

    try {
      model = await promised(ac.org, 'createObject', objectName)
    } catch (err) {
      throw Fault.create('cortex.error.unspecified', {
        reason: 'There was a problem loading a resource dependency.',
        path: resourcePath,
        resource: resourcePath
      })
    }

    if (model.objectName === 'org') {

      return `org.${ac.orgCode}`

    } else if (model.objectName === 'account') {

      return this.addMappedPrincipal(ac, identifier, resourcePath, options)

    } else if (model.objectName === 'object') {

      return this.addMappedObject(ac, objectName, resourcePath, options)

    } else if (!model.uniqueKey) {

      throw Fault.create('cortex.invalidArgument.unspecified', {
        reason: `This object is not exportable`,
        path: resourcePath,
        resource: resourcePath
      })

    }

    // expect a custom query, _id, or by default, lookup the uniqueKey.
    if (isPlainObject(identifier)) {
      searchOptions.internalWhere = identifier
    } else if (couldBeId(identifier)) {
      searchOptions.internalWhere = { _id: getIdOrNull(identifier) }
    } else {
      searchOptions.internalWhere = { [model.uniqueKey]: identifier }
    }
    searchOptions.allowNullSubject = true
    searchOptions.resourcePath = resourcePath

    // make sure the loaded document has everything it needs.
    searchOptions.include = (() => {
      const optional = []
      model.schema.node.walk(node => {
        if (node.hasExportAccess(ac)) {
          optional.push(node.fullpath)
        }
      })
      return optional
    })()

    // read the document. chances are it is going to be included.
    const doc = await promised(model, 'aclReadOne', ac.principal, null, searchOptions),
          code = doc && doc[model.uniqueKey],
          includeResourcePrefix = rBool(options.includeResourcePrefix, false)

    if (!code) {
      throw Fault.create('cortex.unsupportedOperation.unspecified', {
        reason: `The ${model.objectName} ${model.uniqueKey} unique key is not set.`,
        resource: resourcePath,
        path: resourcePath
      })
    }

    mapped = joinPaths(includeResourcePrefix && model.objectName, code)

    if (this.includeDependencies(resourcePath) && !this.wasAdded(mapped)) {

      await model.schema.node.export(
        ac,
        doc,
        this,
        resourcePath,
        { required: true }
      )

    }

    return mapped
  }

  async importMappedApp(ac, uniqueKey, resourcePath) {

    let doc

    const cached = await this.cache.getResource(`app.${uniqueKey}`, { throwNotFound: false })

    if (cached) {
      if (cached.identifier) {
        doc = cached.lookup
      } else {
        this.log('import.dependency', { resource: `app.${uniqueKey}` })
        doc = await ac.org.schema.node.findNode('apps').import(ac, cached.doc, this, resourcePath, { required: true })
        if (doc) {
          await cached.setImportIdentifier(doc._id)
        }
      }
    }

    if (!doc) {
      doc = ac.org.apps.find(app => app.name === uniqueKey)
    }
    if (!doc) {
      throw Fault.create('cortex.notFound.unspecified', {
        reason: `An app dependency "${uniqueKey}" is missing for ${resourcePath}`,
        resource: resourcePath,
        path: resourcePath
      })
    }

    return doc

  }

  async addMappedApp(ac, id, resourcePath, options = {}) {

    if (!id) {
      return null
    }

    const includeResourcePrefix = rBool(options.includeResourcePrefix, false),
          apps = pathTo(await promised(ac.org, 'aclRead', ac.copy(ac.org, {}, true), { paths: ['apps'] }), 'apps'),
          app = apps.find(app => equalIds(app._id, id) || app.name === id || (app.clients[0] && app.clients[0].key === id))

    let mapped

    if (!app) {
      throw Fault.create('cortex.error.unspecified', {
        reason: `There was a problem loading a resource dependency. An app dependency is missing: ${id}`,
        resource: resourcePath,
        path: resourcePath
      })
    } else if (!app.name) {
      throw Fault.create('cortex.unsupportedOperation.unspecified', {
        reason: `The app dependency "${app.label}" does not have a name set, therefore it can't be imported.`,
        resource: resourcePath,
        path: resourcePath
      })
    }

    mapped = joinPaths(includeResourcePrefix && 'app', app.name)

    if (this.includeDependencies(resourcePath)) {
      await ac.org.schema.node.findNode('apps').export(ac, app, this, resourcePath, { required: true })
    }

    return mapped

  }

  async importMappedServiceAccount(ac, serviceAccount, resourcePath) {

    return this.importMappedPrincipal(ac, `serviceAccount.${pathSuffix(serviceAccount)}`, resourcePath)
  }

  async addMappedServiceAccount(ac, serviceAccountId, resourcePath, options = {}) {

    if (!serviceAccountId) {
      return null
    }

    let principal, mapped

    try {
      principal = await promised(ap, 'createServiceAccount', ac.org, serviceAccountId)
    } catch (err) {
      throw Fault.create('cortex.error.unspecified', {
        reason: 'There was a problem loading a resource dependency.',
        resource: resourcePath,
        path: resourcePath
      })
    }

    const includeResourcePrefix = rBool(options.includeResourcePrefix, false),
          serviceAccount = findIdInArray(ac.org.serviceAccounts, '_id', principal._id)

    mapped = joinPaths(includeResourcePrefix && 'serviceAccount', serviceAccount.name)

    if (this.includeDependencies(resourcePath)) {
      await ac.org.schema.node.findNode('serviceAccounts').export(ac, serviceAccount, this, resourcePath, { required: true })
    }

    return mapped

  }

  async loadLocalPrincipal(ac, resourceName, resourcePath) {

    const [objectName, uniqueKey] = pathParts(resourceName)

    switch (objectName) {

      case 'role': {
        let doc = ac.org.roles.find(role => role.code === uniqueKey)
        if (!doc) {
          throw Fault.create('cortex.notFound.unspecified', {
            reason: `A role dependency "${uniqueKey}" is missing for ${resourcePath}`,
            resource: resourcePath,
            path: resourcePath
          })
        }
        return promised(ap, 'createRoleAccount', ac.org, uniqueKey)
      }

      case 'account': {
        let principal
        try {
          principal = await ap.create(ac.org, uniqueKey)
        } catch (err) {}
        if (principal && principal.isAccount()) {
          return principal
        }
        throw Fault.create('cortex.notFound.unspecified', {
          reason: `An account dependency "${uniqueKey}" is missing for ${resourcePath}`,
          resource: resourcePath,
          path: resourcePath
        })
      }

      case 'serviceAccount': {
        let doc = ac.org.serviceAccounts.find(sa => sa.name === uniqueKey)
        if (!doc) {
          throw Fault.create('cortex.notFound.unspecified', {
            reason: `A service account dependency "${uniqueKey}" is missing for ${resourcePath}`,
            resource: resourcePath,
            path: resourcePath
          })
        }
        return promised(ap, 'createServiceAccount', ac.org, uniqueKey)
      }

      default:
        if (isCustomName(resourceName)) {
          return this.loadLocalPrincipal(ac, `serviceAccount.${resourceName}`, resourcePath)
        }
        return this.loadLocalPrincipal(ac, `account.${resourceName}`, resourcePath)
    }

  }

  async importMappedPrincipal(ac, resourceName, resourcePath, { guessResourcePrefix = false } = {}) {

    const [objectName, uniqueKey] = pathParts(resourceName)

    switch (objectName) {

      case 'role': {

        let doc
        if (!builtInRoleCodes.includes(uniqueKey)) {

          const cached = await this.cache.getResource(resourceName, { throwNotFound: false })
          if (cached) {
            if (cached.identifier) {
              doc = cached.lookup
            } else {
              this.log('import.dependency', { resource: resourceName })
              doc = await ac.org.schema.node.findNode('roles').import(ac, cached.doc, this, resourcePath, { required: true })
              if (doc) {
                await cached.setImportIdentifier(doc._id)
              }
            }
          }

        }
        if (!doc) {
          doc = ac.org.roles.find(role => role.code === uniqueKey)
        }
        if (!doc) {
          throw Fault.create('cortex.notFound.unspecified', {
            reason: `A role dependency "${uniqueKey}" is missing for ${resourcePath}`,
            resource: resourcePath,
            path: resourcePath
          })
        }
        return doc
      }

      case 'account': {

        let principal
        try {
          principal = await ap.create(ac.org, uniqueKey)
        } catch (err) {}
        if (principal && principal.isAccount()) {
          return principal.toObject()
        }
        throw Fault.create('cortex.notFound.unspecified', {
          reason: `An account dependency "${uniqueKey}" is missing for ${resourcePath}`,
          resource: resourcePath,
          path: resourcePath
        })

      }

      case 'serviceAccount': {

        let doc

        const cached = await this.cache.getResource(resourceName, { throwNotFound: false })

        if (cached) {
          if (cached.identifier) {
            doc = cached.lookup
          } else {
            this.log('import.dependency', { resource: resourceName })
            doc = await ac.org.schema.node.findNode('serviceAccounts').import(ac, cached.doc, this, resourcePath, { required: true })
            if (doc) {
              await cached.setImportIdentifier(doc._id)
            }
          }
        }

        if (!doc) {
          doc = ac.org.serviceAccounts.find(sa => sa.name === uniqueKey)
        }
        if (!doc) {
          throw Fault.create('cortex.notFound.unspecified', {
            reason: `A service account dependency "${uniqueKey}" is missing for ${resourcePath}`,
            resource: resourcePath,
            path: resourcePath
          })
        }
        return doc

      }

      default:

        // possible for some runtime principal imports where the prefix might not exist. this is only possible
        // for account emails and service account names.
        if (guessResourcePrefix) {

          if (isCustomName(resourceName)) {
            return this.importMappedPrincipal(ac, `serviceAccount.${resourceName}`, resourcePath)
          }

          try {
            const principal = await ap.create(ac.org, resourceName)
            if (principal) {
              return principal.toObject()
            }
          } catch (err) {
            void 0
          }
        }

        throw Fault.create('cortex.unsupportedOperation.unspecified', {
          reason: `The principal type ${resourceName} is not supported for imports.`,
          resource: resourcePath,
          path: resourcePath
        })

    }

  }

  async addMappedPrincipal(ac, principalId, resourcePath, options = {}) {

    if (!principalId) {
      return null
    }

    const includeResourcePrefix = rBool(options.includeResourcePrefix, false)

    let principal, mapped = null

    try {
      principal = await ap.create(ac.org, principalId)
    } catch (err) {
      throw Fault.create('cortex.error.unspecified', {
        reason: 'There was a problem loading a resource dependency.',
        resource: resourcePath,
        path: resourcePath
      })
    }

    if (principal.isAnonymous() || principal.isPublic()) {

      mapped = joinPaths(includeResourcePrefix && 'account', principal.isAnonymous() ? 'anonymous' : 'public')

    } else if (principal.isAccount()) {

      mapped = joinPaths(includeResourcePrefix && 'account', principal.email)

    } else if (principal.isServiceAccount()) {

      const serviceAccount = findIdInArray(ac.org.serviceAccounts, '_id', principal._id)
      mapped = joinPaths(includeResourcePrefix && 'serviceAccount', serviceAccount.name)
      if (this.includeDependencies(resourcePath)) {
        await ac.org.schema.node.findNode('serviceAccounts').export(ac, serviceAccount, this, resourcePath, { required: true })
      }
      if (!serviceAccount.name) {
        throw Fault.create('cortex.unsupportedOperation.unspecified', {
          reason: `The serviceAccount dependency "${serviceAccount.label}" does not have a name set, therefore it can't be added.`,
          resource: resourcePath,
          path: resourcePath
        })
      }

    } else if (principal.isRole()) {

      const role = findIdInArray(ac.org.roles, '_id', principal._id)
      mapped = joinPaths(includeResourcePrefix && 'role', role.code)
      if (this.includeDependencies(resourcePath)) {
        await ac.org.schema.node.findNode('roles').export(ac, role, this, resourcePath, { required: true })
      }
      if (!role.code) {
        throw Fault.create('cortex.unsupportedOperation.unspecified', {
          reason: `The role dependency "${role.name}" does not have a code set, therefore it can't be added.`,
          resource: resourcePath,
          path: resourcePath
        })
      }

    } else {

      throw Fault.create('cortex.unsupportedOperation.unspecified', {
        reason: 'The principal type is not supported.',
        resource: resourcePath,
        path: resourcePath
      })

    }

    return mapped

  }

  deferMediaTrigger(propertyPath, trigger) {

    const { deferredMediaTriggers } = modulePrivates(this)

    if (!deferredMediaTriggers.has(propertyPath)) {
      deferredMediaTriggers.set(propertyPath, trigger)
    }

  }

  async processMediaTriggers() {

    let logInterval,
        currentPath,
        progress = 0

    const { ac, deferredMediaTriggers } = modulePrivates(this),
          org = await promised(modules.db.models.org, 'loadOrg', ac.orgId, { cache: false }),
          principal = await ap.create(org, ac.principal._id),
          totalEntries = deferredMediaTriggers.size,
          entries = Array.from(deferredMediaTriggers.entries()),
          resetInterval = () => {
            clearInterval(logInterval)
            logInterval = setInterval(() => {
              this.log('media.progress', { resource: currentPath, stage: 'media.processing', progress })
            }, 1500)
            logInterval.unref()
          }

    deferredMediaTriggers.clear()

    try {

      let item = 0
      for (let [propertyPath, trigger] of entries) {

        currentPath = propertyPath
        item += 1
        progress = parseFloat((item * 100) / totalEntries).toFixed(2)

        resetInterval()
        this.log('media.progress', { resource: propertyPath, stage: 'media.processing', progress })

        if (this.err) {
          throw this.err
        }

        trigger()

        // wait until it's done.
        const waitFor = 30 * 1000,
              waitStart = Date.now(),
              waitInterval = 100,
              [objectName, fullPath] = pathParts(propertyPath),
              [subjectId, filePath] = pathParts(fullPath)

        while ((Date.now() - waitStart) < waitFor) {

          if (this.err) {
            throw this.err
          }

          try {

            const object = await promised(org, 'createObject', objectName),
                  file = await promised(object, 'aclReadPath', principal, subjectId, filePath, { override: true }),
                  facets = file && [file, ...toArray(file.facets)]

            if (facets.every(({ name, location, storageId, state, uploads }) => {

              if (state === consts.media.states.error) {
                return true
              }
              for (let upload of toArray(uploads)) {
                if (upload.location === consts.LocationTypes.UploadObject) {
                  return false
                }
              }
              return true
            })) {
              break
            }

          } catch (err) {
            break
          }

          if (this.ended) {
            return
          }

          await sleep(waitInterval)

        }

      }
    } finally {

      clearInterval(logInterval)

    }

  }

}

module.exports = {
  ResourceStream
}
