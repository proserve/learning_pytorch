'use strict'

const Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      jp = require('jsonpath'),
      _ = require('underscore'),
      modules = require('..'),
      mime = require('mime'),
      { Readable } = require('stream'),
      modulePrivates = require('../../classes/privates').createAccessor(),
      { InputStream } = require('../../classes/chunk-stream'),
      {
        promised, rBool, joinPaths, rVal,
        option: getOption, rString, clamp, createId, rInt,
        normalizeObjectPath, array: toArray, pathParts,
        isCustomName, isUuidString, path: pathTo
      } = require('../../utils'),
      safePathTo = require('../../classes/pather').sandbox,
      lookupCache = modules.cache.memory.add('cortex.imports.resources.lookup'),
      clone = require('clone')

let Undefined

function lazyGetter(privates, prop) {

  if (!privates[prop]) {
    const { doc } = privates,
          { resource } = doc,
          [objectName, uniqueKey] = pathParts(resource),
          environmentPath = modules.developer.consts.envResourcePaths[objectName],
          isEnvResource = !!environmentPath,
          isCustomObject = !isEnvResource && isCustomName(objectName),
          modelName = isCustomObject ? objectName : modules.developer.consts.resourceModels[objectName]

    Object.assign(privates, {
      objectName,
      uniqueKey,
      modelName,
      isEnvResource,
      environmentPath,
      isCustomObject
    })
  }
  return privates[prop]

}

class ResourceDoc {

  constructor(rc, input) {

    const { doc, lookup, identifier, facets, group } = input,
          privates = modulePrivates(this)

    Object.assign(privates, {
      rc,
      doc: (typeof doc === 'string') ? JSON.parse(doc) : (doc || {}),
      lookup: lookup || {},
      identifier,
      facets: toArray(facets),
      type: 'resource',
      group
    })
  }

  get group() {
    return modulePrivates(this).group
  }

  get identifier() {
    return modulePrivates(this).identifier
  }

  get lookup() {
    return modulePrivates(this).lookup
  }

  get type() {
    return modulePrivates(this).type
  }

  get facets() {
    return modulePrivates(this).facets
  }

  get accept() {
    return modulePrivates(this).accept
  }

  get doc() {
    return modulePrivates(this).doc
  }

  get resourcePath() {
    const { lookup, doc } = modulePrivates(this)
    return (lookup && lookup.resource) || (doc && doc.resource)
  }

  get uniqueKey() {
    return lazyGetter(modulePrivates(this), 'uniqueKey')
  }

  get objectName() {
    return lazyGetter(modulePrivates(this), 'objectName')
  }

  get modelName() {
    return lazyGetter(modulePrivates(this), 'modelName')
  }

  get isCustomObject() {
    return lazyGetter(modulePrivates(this), 'isCustomObject')
  }

  get isEnvResource() {
    return lazyGetter(modulePrivates(this), 'isEnvResource')
  }

  get environmentPath() {
    return lazyGetter(modulePrivates(this), 'environmentPath')
  }

  toJSON() {
    const { doc, identifier, lookup, facets, required } = modulePrivates(this)
    return {
      doc: JSON.stringify(doc),
      identifier,
      lookup,
      facets,
      required
    }
  }

  toObject() {

    const { group, identifier, lookup, type, facets, accept, doc, uniqueKey, objectName } = this
    return { group, identifier, lookup, type, facets, accept, doc, uniqueKey, objectName }

  }

  getCacheKey(resourceName = '', prefix = 'resource') {

    const { cacheKey } = modulePrivates(this)
    return `${cacheKey}${prefix}.${rString(resourceName, '')}`
  }

  async setImportIdentifier(identifier = null, properties = {}) {

    const privates = modulePrivates(this),
          { rc, doc, lookup } = privates,
          resourceKey = rc.getCacheKey(lookup.resource, 'resource')

    privates.identifier = identifier
    Object.assign(doc, { _id: identifier })
    Object.assign(lookup, { _id: identifier, ...properties })

    lookupCache.set(resourceKey, { identifier, lookup: clone(lookup) })

    await promised(modules.cache, 'set', null, resourceKey, this.toJSON(), rc.cacheTtl)
    return identifier
  }

}

class ResourceFacet extends ResourceDoc {

  constructor(rc, entry) {

    super(rc, { ...entry, group: 'facets' })
    const { host, path, uploadId, uploadExists, uploadComplete, uploadErr, uploadStreamId } = entry

    Object.assign(modulePrivates(this), {
      host,
      path,
      uploadId,
      uploadExists: rBool(uploadExists, true),
      uploadComplete: rBool(uploadComplete, false),
      uploadErr: rVal(uploadErr, null),
      uploadStreamId: rVal(uploadStreamId, null),
      uploadStream: null,
      type: 'facet'
    })
  }

  toJSON() {

    const { host, path, uploadId, uploadExists, uploadComplete, uploadErr, uploadStreamId } = modulePrivates(this)

    return Object.assign(
      super.toJSON(),
      { host, path, uploadId, uploadExists, uploadComplete, uploadErr, uploadStreamId }
    )
  }

  toObject() {

    const { host, path, uploadId, uploadExists, uploadComplete, uploadErr, uploadStreamId } = modulePrivates(this)

    return Object.assign(
      super.toObject(),
      { host, path, uploadId, uploadExists, uploadComplete, uploadErr, uploadStreamId }
    )
  }

  get fqpp() {
    return modulePrivates(this).fqpp
  }

  get uploadId() {
    return modulePrivates(this).uploadId
  }

  get uploadExists() {
    return modulePrivates(this).uploadExists
  }

  get uploadComplete() {
    return modulePrivates(this).uploadComplete
  }

  get uploadStreamId() {
    return modulePrivates(this).uploadStreamId
  }

  get uploadStream() {
    return modulePrivates(this).uploadStream
  }

  get uploadErr() {
    return modulePrivates(this).uploadErr
  }

  get host() {
    return modulePrivates(this).host
  }

  get path() {
    return modulePrivates(this).path
  }

  async cancelUpload() {

    const privates = modulePrivates(this)

    if (privates.uploadStream) {
      try {
        privates.uploadStream.destroy()
      } catch (err) {}
      privates.uploadStream = null
    }

  }

  async completeUpload(err = null, uploadExists = true) {

    const privates = modulePrivates(this),
          { rc, doc } = privates,
          resourceKey = rc.getCacheKey(doc.resourceId, 'facet')

    if (!privates.uploadComplete || (err && !privates.uploadErr)) {
      privates.uploadErr = err ? Fault.from(err, false, true).toJSON() : null
      privates.uploadComplete = true
      privates.uploadExists = uploadExists
    }

    await this.cancelUpload()
    await promised(modules.cache, 'set', null, resourceKey, this.toJSON(), rc.cacheTtl)
  }

  async createUpload(ac, facetResource) {

    const privates = modulePrivates(this),
          { doc, host, path, uploadId } = privates,
          { type, resource } = host,
          { resourceId, name } = doc,
          resourceParts = resource.split('.'),
          propertyPath = normalizeObjectPath(path.join('.'), true, true, true),
          objectName = resourceParts[0],
          Upload = modules.db.models.Upload

    let modelName,
        model,
        nodes,
        node,
        processor,
        fqpp,
        uploadStream,
        uploadRequest,
        filename

    if (objectName === 'env') {
      modelName = 'org'
    } else if (isCustomName(objectName)) {
      modelName = objectName
    }
    if (modelName) {

      model = await promised(ac.org, 'createObject', modelName)
      model = model.getModelForType(type)

      nodes = model.schema.node.findNodes(propertyPath, []).filter(node => node.getTypeName() === 'File')
      node = nodes[0]
      processor = node && Array.isArray(node.processors) ? node.processors.find(processor => processor.name === name) : null

      if (nodes.length > 1) {
        throw Fault.create('cortex.invalidArgument.unspecified', {
          path: resource,
          reason: 'Uploads for similarly named File properties across Sets is unsupported.'
        })
      }

      // tolerate unknown file properties and processors, using sane defaults.
      if (node) {
        fqpp = node.fqpp
      } else {
        fqpp = `${modelName}.${propertyPath}.???`
      }
    } else {
      fqpp = `${objectName}.${propertyPath}.???`
    }

    if (facetResource.base64) {

      const buffer = Buffer.from(facetResource.base64, 'base64')

      uploadStream = new Readable()
      uploadStream.push(buffer)
      uploadStream.push(null)

    } else if (facetResource.streamId) {

      if (!isUuidString(facetResource.streamId)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: `The streamId for facet "${resourceId}" in "${resource}" must be a uuid.` })
      }

      privates.uploadStreamId = facetResource.streamId

      // store whatever comes in this file and return immediately so we can continue listening to the resource stream.
      uploadStream = new InputStream()

      uploadStream.once('error', (err) => {
        if (uploadRequest) {
          uploadRequest.cancel(err)
        }
        err = Fault.from(err, false, true)
        err.path = propertyPath
        this.completeUpload(err, true)
      })

    }

    if (uploadStream) {

      privates.uploadStream = uploadStream
      privates.fqpp = fqpp

      filename = facetResource.filename || `import.${mime.extension(facetResource.mime) || 'dat'}`

      uploadRequest = Upload.createUpload(ac.principal, uploadStream, filename, facetResource.mime, null, processor, { uploadId }, async(err) => {
        err = err || uploadRequest.err
        if (err) {
          if (err.errCode === 'cortex.invalidArgument.tooLarge') {
            err.reason = `Facet "${resourceId}" max file size exceeded.`
          }
          err.path = fqpp
        }

        await this.completeUpload(err, true)

      })

    } else {

      await this.completeUpload(null, false)

    }

  }

}

class ResourceCache {

  /**
   *
   * @param input
   *  cacheKey: null
   *  cacheTtl: defaults to 3600. 60 - 3600 seconds
   */
  constructor(input) {

    const options = input || {},
          privates = modulePrivates(this)

    Object.assign(privates, {
      maxResources: clamp(rInt(options.maxResources, 10000), 1, 10000),
      cacheKey: `modules.developer.resourceCache.${rString(options.cacheKey, '')}.${createId()}$`,
      cacheTtl: clamp(rInt(options.cacheTtl, 3600), 60, 3600),
      added: new Set(),
      dependencies: {},
      activeUploads: []
    })

  }

  get cacheTtl() {
    return modulePrivates(this).cacheTtl
  }

  get cacheKey() {
    return modulePrivates(this).cacheTtl
  }

  /**
   * fires up an UploadObject.
   *
   * facets must already be represented in a cached document.
   *
   * @param ac
   * @param doc
   * @returns {Promise<void>}
   */
  async initiateUploadStream(ac, doc = {}) {

    const { activeUploads } = modulePrivates(this),
          { resourceId } = doc || {},
          registeredFacet = await this.getFacet(resourceId)

    if (!isUuidString(resourceId)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: `The facet resourceId facet must be a uuid.` })
    }

    // handles caching files.
    await registeredFacet.createUpload(ac, doc)

    activeUploads.push(registeredFacet)

  }

  async cancelUploads() {

    const { activeUploads } = modulePrivates(this)

    for (const resource of activeUploads) {
      await resource.cancelUpload()
    }

  }

  async ingestUploadStream(doc) {

    let err

    const { activeUploads } = modulePrivates(this),
          streamId = doc && doc.object === 'stream' && doc.streamId,
          registeredFacet = activeUploads.find(v => v.uploadStreamId === streamId),
          { uploadStream } = registeredFacet || {}

    if (!registeredFacet) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Missing stream for streamId ${streamId}.` })
    }

    try {
      uploadStream.write(doc)
    } catch (e) {
      err = e
    }

    if (err) {
      await this.cancelUploads()
      throw err
    }

  }

  /**
   * build a cache key
   *
   * @param resourceName
   * @param prefix
   * @returns {*}
   */
  getCacheKey(resourceName = '', prefix = 'resource') {

    const { cacheKey } = modulePrivates(this)
    return `${cacheKey}${prefix}.${rString(resourceName, '')}`
  }

  /**
   * list all cached resources
   *
   * @returns {Promise<*>}
   */
  async listResources(objectName = '') {
    return this.listKeys(joinPaths('resource', objectName), true)
  }

  /**
   * list all facets
   *
   * @returns {Promise<*>}
   */
  async listFacets() {
    return this.listKeys('facet', true)
  }

  async listKeys(prefix = 'resource', trim = false) {

    const keys = [],
          cacheKey = this.getCacheKey('', prefix),
          limit = 100

    let skip = 0, done = false

    return new Promise((resolve, reject) => {
      async.whilst(
        () => !done,
        async() => {

          const list = await promised(modules.cache, 'list', null, cacheKey, skip, limit),
                data = list.data.map(v => trim ? v.key.replace(cacheKey, '') : v.key)

          done = data.length === 0
          keys.push(...data)
          skip += limit

        },
        err => {
          err ? reject(err) : resolve(keys.sort())
        }
      )
    })

  }

  async getObjects(resourcePath, prefix = 'resource') {

    const objects = [],
          cacheKey = this.getCacheKey(resourcePath, prefix),
          limit = 100

    let skip = 0, done = false

    return new Promise((resolve, reject) => {
      async.whilst(
        () => !done,
        async() => {

          const list = await promised(modules.cache, 'find', null, cacheKey, skip, limit),
                data = list.map(v => v.val)

          done = data.length === 0
          objects.push(...(data.map(v => new ResourceDoc(this, v))))
          skip += limit

        },
        err => {
          err ? reject(err) : resolve(objects)
        }
      )
    })

  }

  /**
   * clear the cache
   * @returns {Promise<void>}
   */
  async clear() {

    const { cacheKey } = modulePrivates(this)

    // clear the cache
    return promised(modules.cache, 'clear', null, cacheKey)

  }

  async lookupResource(search = {}) {

    let resource

    const resourceKey = Object.keys(search).length === 1 && _.isString(search.key) && search.key
    if (resourceKey) {
      resource = lookupCache.get(resourceKey)
    }

    if (!resource) {
      resource = await modules.cache.findOne(null, search, ['identifier', 'lookup'])
      if (resourceKey) {
        lookupCache.set(resourceKey, clone(resource))
      }
    }

    return resource && new ResourceDoc(this, resource)
  }

  /**
   * find a cache resource
   *
   * @param resourceName
   * @param options
   *  throwNotFound: true
   * @returns {Promise<*|Promise<*>>}
   */
  async getResource(resourceName, options) {

    const throwNotFound = rBool(getOption(options, 'throwNotFound'), true),
          resource = await promised(modules.cache, 'get', null, this.getCacheKey(resourceName))

    if (resource === Undefined && throwNotFound) {
      throw Fault.create('cortex.notFound.unspecified', {
        reason: `The resource "${resourceName}" does not exist in the cache.`,
        path: resourceName
      })
    }
    return resource && new ResourceDoc(this, resource)
  }

  async findResource(resourcePath, search = {}) {

    const matchingKeys = await this.listResources(resourcePath),
          searchKeys = Object.keys(search)

    for (const matchingKey of matchingKeys) {
      const resource = await this.getResource(`${resourcePath}.${matchingKey}`, { throwNotFound: false })
      if (searchKeys.every(key => search[key] === safePathTo(resource.doc, key))) {
        return resource
      }
    }

    return Undefined
  }

  /**
   * find all cached resources based on a prefix
   *
   * @param resourcePath
   * @returns {Promise<*|Promise<*>>}
   */
  async getResources(resourcePath) {
    return this.getObjects(resourcePath, 'resource')
  }

  /**
   * renames a resource and all facet hosts.
   * @returns {Promise<void>}
   */
  async renameResource(oldResourcePath, newResourcePath) {

    const { added, cacheTtl } = modulePrivates(this)

    if (!added.has(oldResourcePath)) {

      return false

    } else {

      added.delete(oldResourcePath)
      added.add(newResourcePath)

      const newCacheKey = this.getCacheKey(newResourcePath),
            updated = await promised(modules.cache, 'swap', null, this.getCacheKey(oldResourcePath), newCacheKey),
            resource = await this.getResource(newResourcePath)

      resource.doc.resource = newResourcePath
      resource.lookup.resource = newResourcePath

      await promised(modules.cache, 'set', null, newCacheKey, resource.toJSON(), cacheTtl)

      lookupCache.set(this.getCacheKey(oldResourcePath), Undefined)
      lookupCache.set(newCacheKey, { identifier: resource.identifier, lookup: clone(resource.lookup) })

      return updated
    }
  }

  /**
   *
   * @param doc
   * @param group
   * @param identifierPaths // paths to store on import. useful for findResource()
   * @returns {Promise<void>}
   */
  async cacheResource(doc, group = 'default', identifierPaths = ['resource', 'type', 'name']) {

    const { cacheTtl, added, maxResources } = modulePrivates(this),
          resourceKey = this.getCacheKey(doc.resource, 'resource'),
          resource = {
            doc,
            facets: [],
            identifier: null,
            lookup: identifierPaths.reduce((lookup, path) => pathTo(lookup, path, pathTo(doc, path), true), {}),
            group
          }

    added.add(doc.resource)
    if (added.size > maxResources) {
      throw Fault.create('cortex.invalidArgument.unspecified', {
        reason: `The maximum number of resources (${maxResources}) has been reached.`,
        path: doc.resource
      })
    }

    // scan the resource for facets and store them so we can look them up later.
    let docFacets = jp.nodes(doc, '$..resourceId').map(node => {
      const facet = jp.value(doc, node.path.slice(0, node.path.length - 1))
      if (facet && facet.object === 'facet' && node.path.length > 2) {
        if (!isUuidString(facet.resourceId)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: `The facet resourceId in "${doc.resource}" must be a uuid.` })
        }
        if (!facet.name) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: `The facet "${facet.resourceId}" in "${doc.resource}" must have a name property that identifies the processor.` })
        }
        return new ResourceFacet(this, {
          doc: _.pick(facet, 'name', 'resourceId'),
          host: _.pick(doc, 'resource', 'type', 'object'),
          path: node.path.slice(1, node.path.length - 1),
          uploadId: createId()
        })
      }
      return null
    }).filter(v => v)

    await new Promise((resolve, reject) => {
      async.eachSeries(
        docFacets,
        async(entry) => {

          const { doc } = entry,
                facetKey = this.getCacheKey(doc.resourceId, 'facet'),
                { host } = (await promised(modules.cache, 'get', null, facetKey)) || {}

          if (host) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: `A facet with resourceId "${doc.resourceId}" already exists in "${host.resource}".` })
          }

          added.add(`facet.${doc.resourceId}`)
          if (added.size > maxResources) {
            throw Fault.create('cortex.invalidArgument.unspecified', {
              reason: `The maximum number of resources (${maxResources}) has been reached.`,
              path: `facet.${doc.resourceId}`
            })
          }

          resource.facets.push(doc.resourceId)

          await promised(modules.cache, 'set', null, facetKey, entry.toJSON(), cacheTtl)

        },
        err => {
          err ? reject(err) : resolve()
        }
      )

    })

    await promised(modules.cache, 'set', null, resourceKey, (new ResourceDoc(this, resource)).toJSON(), cacheTtl)

  }

  /**
   *
   * @returns {Promise<void>}
   */
  async getFacet(resourceId, options) {

    const throwNotFound = rBool(getOption(options, 'throwNotFound'), true),
          facetKey = this.getCacheKey(resourceId, 'facet'),
          facet = await promised(modules.cache, 'get', null, facetKey)

    if (facet === Undefined && throwNotFound) {
      throw Fault.create('cortex.notFound.unspecified', {
        reason: `The facet with resourceId "${resourceId}" was not found. Make sure facets come after their host resources`,
        path: resourceId
      })
    }

    return facet && new ResourceFacet(this, facet)

  }

  /**
   * find all facets with matching resource ids
   *
   * @param resourceIds
   * @returns {Promise<*|Promise<*>>}
   */
  async getFacets(resourceIds) {

    return (await Promise.all(toArray(resourceIds, resourceIds).map(async(resourceId) => {

      return this.getFacet(resourceId, { throwNotFound: false })

    }))).filter(v => v)

  }

  async getUploadStatus() {

    const { activeUploads } = modulePrivates(this),
          status = {
            total: 0, // total facet count
            uploads: 0, // with uploads
            complete: 0, // how many are done
            errors: 0, // how many errors
            facets: [] // individual status
          }

    for (const facet of Object.values(activeUploads)) {
      const { uploadId, uploadExists, uploadComplete, uploadErr } = facet
      status.facets.push({ uploadId, uploadExists, uploadComplete, uploadErr })
      status.total += 1
      if (uploadExists) {
        status.uploads += 1
      }
      if (uploadComplete) {
        status.complete += 1
      }
      if (uploadErr) {
        status.errors += 1
      }
    }
    return status
  }

}

module.exports = {
  ResourceCache
}
