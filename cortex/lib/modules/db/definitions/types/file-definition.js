'use strict'

const util = require('util'),
      modules = require('../../../../modules'),
      uuid = require('uuid'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../../utils'),
      { array: toArray, naturalCmp, normalizeObjectPath, path: pathTo, findIdInArray,
        normalizeAcPathParts, promised, joinPaths, rBool, rVal, equalIds, getIdArray,
        findIdPos, uniqueIdArray, digIntoResolved, pathToPayload, rString
      } = require('../../../../utils'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      mime = require('mime'),
      async = require('async'),
      path = require('path'),
      Url = require('url'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      DocumentDefinition = require('./document-definition'),
      PropertyDefinition = require('../property-definition'),
      { DeferredRead } = require('../classes/deferred-read'),
      properties = require('../properties'),
      local = {
        _definitions: null
      },
      CommonInternalFacetNames = ['content', 'document', 'thumbnail', 'original', 'overlay']

let Undefined

class DeferredTranslatedFile extends DeferredRead {

  async read() {
    let deferred = []
    const { parent, key, input } = this,
          { key: translateKey, locale, namespace, fullpath } = input,
          translateResult = await this.ac.org.i18n.translateFile(this.ac, translateKey, { locale, namespace })

    if (!translateResult || !translateResult.asset || !translateResult.bundle) {
      logger.warn(`i18n: File localization was not found for key ${translateKey}, namespace ${namespace}, locale ${locale}`)
      return Undefined
    }

    // eslint-disable-next-line one-var
    const { asset: localizedDoc, bundle } = translateResult,
          isArray = this.node.array,
          result = localizedDoc.map(value => {
            const file = fileReaderParseFacets(this.ac, value, this.node, this.selection, locale, bundle)

            // find nested DeferredRead instances
            utils.walk(file, true, true, (dr, keyOrIndex, objOrArray, isArray) => {
              if (dr instanceof DeferredRead) {
                dr.init(keyOrIndex, objOrArray, isArray, file)
                deferred.push(dr)
              }
              return dr
            })

            return file
          })

    // Perform deferred reads
    for (let dr of deferred) {
      try {
        await dr.read()
      } catch (e) {
        // This read may throw, but ModelDefinition.readGrouped catches it.
        logger.error('i18n: Error trying to perform a deferred read', e)
        throw e
      }
    }

    if (isArray) {
      pathTo(parent, key, processArrayEntries(result, this.selection, this.ac, fullpath))
    } else {
      pathTo(parent, key, result[0])
    }

    return Undefined
  }

}

class DeferredPointerRead extends DeferredRead {

  async read() {

    const { ac, input, parent, key } = this,
          { pointer } = input,
          result = await promised(modules.streams, 'getPointerUrl', ac, pointer)

    pathTo(parent, key, result)

  }

}

class DeferredUrlRead extends DeferredRead {

  async read() {

    const { ac, input, parent, key } = this,
          { pointer } = input

    let url = null

    try {
      const result = await promised(modules.streams, 'getPointerUrl', ac, pointer)
      if (result && result.url) {
        url = result.url
      }
    } catch (err) {
      void err
    }
    pathTo(parent, key, url)

  }

}

Object.defineProperty(local, 'definitions', { get: function() { return (this._definitions || (this._definitions = require('../index'))) } })

function isBase64(str) {
  const notEx = /[^A-Z0-9+/=]/i
  if (_.isString(str)) {
    const len = str.length
    if ((len > 0 && (len % 4 === 0)) || !notEx.test(str)) {
      const firstPaddingChar = str.indexOf('=')
      return firstPaddingChar === -1 || firstPaddingChar === len - 1 || (firstPaddingChar === len - 2 && str[len - 1] === '=')
    }
  }
  return false
}

function normalizeSource(source) {

  if (source) {
    if (_.isString(source)) {
      try {
        if (source.indexOf('buffer://') === 0) {
          const str = source.slice(9)
          return { source: 'buffer', buffer: Buffer.from(str, isBase64(str) ? 'base64' : 'utf8') }
        } else if (source.indexOf('file://') === 0 || source.indexOf('upload://') === 0) {
          return { source: 'upload', filename: source.slice(7) }
        } else if (source.indexOf('facet://') === 0) {
          return { source: 'facet', path: source.slice(8) }
        } else {
          const url = Url.parse(source)
          if (!url.protocol && url.path && url.path === url.pathname) {
            const parts = normalizeObjectPath(url.path.replace(/\//g, '.')).split('.')
            if (parts.length > 2 && parts[0].match(/^[a-zA-Z0-9-_]{1,255}$/) && utils.couldBeId(parts[1])) {
              return { source: 'facet', path: url.path }
            }
            return { source: 'upload', filename: source }
          } else if (url.protocol === 'http:' || url.protocol === 'https:') {
            return { source: 'url', url: source, filename: path.basename(url.pathname) }
          }
        }
      } catch (err) {}
      return null
    } else if (Buffer.isBuffer(source)) {
      return { source: 'buffer', buffer: source }
    } else if (source.buffer) {
      return { source: 'buffer', buffer: source.buffer, filename: source.filename, mime: source.mime }
    } else if (source.upload) {
      return { source: 'upload', filename: source.upload }
    } else if (source.facet) {
      return { source: 'facet', path: source.facet, filename: source.filename }
    }
  }
  return source
}

function FileDefinition(options) {

  this.docWriter = docWriter
  this.reader = fileReader

  options = options || {}
  options.indexed = false
  options.reader = this.reader
  options.uniqueValues = false

  options.virtual = false
  options.canPush = true
  options.remover = false

  if (options.array) {
    options.docWriter = this.docWriter
    options.pusher = null
    options.writer = null
  } else {
    options.docWriter = null
    options.pusher = null
    options.writer = this.docWriter
  }

  const localization = options.localization || {},
        processors = utils.array(utils.option(options, 'processors')).map(processorOptions => {
          let Processor = modules.db.definitions.processorDefinitions[processorOptions.type]
          if (Processor) {
            return new Processor(processorOptions, options)
          } else {
            throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing processor type: ' + processorOptions.type })
          }
        })

  this.localization = {
    enabled: rBool(localization.enabled, false),
    aclOverride: rBool(localization.aclOverride, false),
    acl: (localization.acl === acl.Inherit) ? acl.Inherit : acl.mergeAndSanitizeEntries(localization.acl),
    strict: rBool(localization.strict, false),
    fallback: rBool(localization.fallback, true),
    valid: toArray(localization.valid),
    fixed: rString(localization.fixed, ''),
    namespace: rString(localization.namespace, ''),
    translationKey: rString(localization.translationKey, '')
  }

  options.properties = [
    {
      label: 'Creator',
      name: 'creator',
      type: 'ObjectId',
      // description: 'The original file creator',
      readable: true,
      public: false
    },
    {
      label: 'Facets',
      name: 'facets',
      type: 'Any',
      serializeData: false,
      // description: 'The file facets',
      readable: false,
      public: false
    },
    {
      label: 'Sources',
      name: 'sources',
      type: 'Any',
      serializeData: false,
      // description: 'The file facets',
      readable: false,
      public: false
    }

  ]

  options.mergeOverwrite = rBool(options.mergeOverwrite, true)

  DocumentDefinition.call(this, options)

  // add top-level facets when selecting.
  this.addDependency('facets')

  // prepare processor definitions.

  processors.forEach((processor, i, a) => {
    processor.initDependencies(a)
  })

  this.processors = processors
  this.uploader = 'aws-s3'

  this.urlExpirySeconds = options.urlExpirySeconds

}
util.inherits(FileDefinition, DocumentDefinition)

FileDefinition.typeName = 'File'
FileDefinition.mongooseType = null

FileDefinition.prototype.isIndexable = false

FileDefinition.prototype.getTypeName = function() {
  return FileDefinition.typeName
}

FileDefinition.prototype.apiSchema = function(options) {

  let schema = DocumentDefinition.prototype.apiSchema.call(this, options)
  if (schema) {

    schema.uploader = this.uploader

    schema.processors = this.processors.map(function(processor) {
      return processor.apiSchema(options)
    })

  }
  return schema

}

FileDefinition.prototype._getHistoryValue = function(ac, rootDocument, value, previous, index, operation) {

  const { remove, pull, push } = consts.audits.operations,
        useCurrentValue = [remove, pull, push].includes(operation)

  let fileDoc

  if (useCurrentValue) {
    fileDoc = value
  } else {
    fileDoc = ac.org.configuration.legacyAuditHistoryValues ? rVal(previous, value) : previous
  }

  // merge the content facet info in with the fileDoc pid. the fileId and content facet id should match.
  if (fileDoc) {

    const facetsIndex = toArray(pathTo(rootDocument, 'facets'))

    let out = {},
        facets = []

    toArray(fileDoc.facets).forEach(facetId => {
      let facet = findIdInArray(facetsIndex, 'pid', facetId)
      if (facet) {
        let pointer = modules.storage.create(this, facet, ac)
        if (pointer) {
          facet = pointer.aclRead(ac.principal, { skipAcl: true })
          if (facet) {
            if (facet.name === 'content') {
              utils.extend(out, facet) // except the creator! which remains the initial fileDoc structure creator.
              out.creator = fileDoc.creator
            } else {
              facets.push(facet)
            }
          }
        }
      }
    })
    if (facets.length > 0) {
      out.facets = facets
    }
    if (out.name || out.facets) {
      if (this.array) {
        out._id = fileDoc._id
      }
      out.creator = fileDoc.creator
    }
    return out
  }
  return undefined

}

FileDefinition.prototype._updateHistoryDocument = function(ac, op, changes) {

  const subject = ac.subject

  let newValue = digIntoResolved(subject._doc, op.path, true, true)

  if (newValue !== undefined) {

    if (_.isFunction(newValue.toObject)) {
      newValue = newValue.toObject()
    }
    if (this.array) {
      newValue = toArray(newValue).map(v => _.omit(v, 'sources'))
    } else {
      newValue = _.omit(newValue, 'sources')
    }

    // update the document.
    pathToPayload(op.path, newValue, changes.document)

    // add the facets to the facets index.
    const facetIds = toArray(newValue, true)
      .reduce((memo, file) =>
        uniqueIdArray([
          ...memo,
          ...toArray(pathTo(file, 'facets'))
        ])
      , [])

    if (!Array.isArray(pathTo(changes, 'document.facets'))) {
      changes.document.facets = []
    }

    for (let facetId of facetIds) {

      const facet = findIdInArray(subject.facets, 'pid', facetId)
      if (facet) {
        const pos = findIdPos(changes.document.facets, 'pid', facetId)
        if (pos !== -1) {
          changes.document.facets[pos] = facet
        } else {
          changes.document.facets.push(facet)
        }
      }

    }

  }

}

FileDefinition.getProperties = function() {

  return [
    { name: 'indexed', default: false, writable: false, public: false },
    { name: 'unique', default: false, writable: false },
    { name: 'history', default: false, writable: true },
    { name: 'auditable', default: false, writable: true },
    { name: 'validators', readable: true, writable: true },
    {
      label: 'Processors',
      name: 'processors',
      type: 'Set',
      // description: 'The result of each processor is added to the resulting File property value array.',
      readable: true,
      writable: true,
      canPush: true,
      canPull: true,
      array: true,
      minItems: 1,
      maxItems: 5,
      discriminatorKey: 'type',
      uniqueProp: 'name',
      uniqueKey: 'name',
      documents: modules.db.definitions.createProcessorProperties(),
      dependencies: ['.processors.required', '.processors.passMimes', '.processors.private'],
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'A "content" processor is required, and must have required=true, passMimes=false, private=false',
          validator: function(ac, node, values) {
            let content = _.find(values, function(v) { return v.name === 'content' })
            return !!(content && content.required === true && content.passMimes === false && content.private === false)
          },
          asArray: true
        }
      }]
    },
    {
      label: 'Uploader',
      name: 'uploader',
      type: 'String',
      // description: 'The upload endpoint for this property.',
      readable: false,
      writable: false,
      default: 'aws-s3',
      validators: [ {
        name: 'required'
      }, {
        name: 'stringEnum',
        definition: {
          values: ['aws-s3']
        }
      }]
    },
    {
      // the url expiry in seconds
      label: 'Url Expiry Seconds',
      name: 'urlExpirySeconds',
      type: 'Number',
      acl: acl.Inherit,
      writable: true,
      default: null,
      writer: function(ac, node, value) {
        return value || null // convert false-y values to null
      },
      validators: [{
        name: 'number',
        definition: { min: 5, max: 604800, allowNull: true, allowDecimal: false }
      }]
    },
    {
      label: 'Localization',
      name: 'localization',
      type: 'Document',
      writable: true,
      properties: [
        {
          label: 'Enabled',
          name: 'enabled',
          type: 'Boolean',
          readable: true,
          writable: true,
          default: false,
          validators: [{
            name: 'adhoc',
            definition: {
              message: 'Localization cannot be disabled.',
              construct: function(type) {
                const node = type.options.propertyNode,
                      // -> insert on value added to check for previous value. type.options.propertyNode._onValueAdded
                      onValueAdded = function(ac, node, value, previous) {
                        if (this.isModified(node.docpath)) {
                          if (this.$__localizationEnabledOriginalValues === Undefined) {
                            this.$__localizationEnabledOriginalValues = { value: previous }
                          }
                        }
                      }
                if (node._onValueAdded) {
                  let _onValueAdded = node._onValueAdded
                  node._onValueAdded = function(ac, node, value, previous, index) {
                    _onValueAdded.call(this, ac, node, value, previous, index)
                    onValueAdded.call(this, ac, node, value, previous, index)
                  }

                } else {
                  node._onValueAdded = onValueAdded
                }
              },
              validator: function(ac, node, enabled) {
                const original = this.$__localizationEnabledOriginalValues
                if (this.isNew || enabled || (original && original.value !== true)) {
                  return true
                }
                return false
              }
            }
          }, {
            name: 'adhoc',
            definition: {
              message: 'Localized properties cannot be made unique.',
              validator: function(ac, node, enabled) {
                return !(enabled && this.unique)
              }
            }
          }]
        },
        {
          // limit writing to a set of locales for this property to a set. leaving this empty allows all org-level valid locales.
          label: 'Locales',
          name: 'valid',
          type: 'String',
          array: true,
          uniqueValues: true,
          maxItems: -1,
          readable: true,
          writable: true,
          default: [],
          validators: [{
            name: 'locale'
          }]
        },
        {
          // limit the native string property to reading and writing this locale. for reading, fallback still applies.
          label: 'Fixed Locale',
          name: 'fixed',
          type: 'String',
          array: false,
          readable: true,
          writable: true,
          default: '',
          validators: [{
            name: 'locale',
            definition: {
              allowBlank: true
            }
          }]
        },
        {
          // for reading and writing, throw an error if the selected locale is invalid.
          label: 'Strict',
          name: 'strict',
          type: 'Boolean',
          readable: true,
          writable: true,
          default: true
        },
        {
          // for reading, fallback to any usable locale value when none exists for the requested locale.
          label: 'Fallback',
          name: 'fallback',
          type: 'Boolean',
          readable: true,
          writable: true,
          default: true
        },
        {
          label: 'i18n Bundle Key',
          name: 'translationKey',
          type: 'String',
          readable: true,
          writable: true,
          validators: [{
            name: 'dotPath'
          }]
        },
        {
          label: 'i18n namespace',
          name: 'namespace',
          type: 'String',
          readable: true,
          writable: true,
          default: 'cortex'
        },
        properties.acl,
        properties.readAccess,
        properties.writeAccess,
        {
          label: 'ACL Override',
          name: 'aclOverride',
          type: 'Boolean',
          default: false,
          readable: true,
          writable: true
        }
      ]
    }
  ]
}

module.exports = FileDefinition

FileDefinition.prototype.initNode = function(root, parent, initializingASetDocument, isSetProperty) {

  if (this.parent) {
    return
  }

  DocumentDefinition.prototype.initNode.call(this, root, parent, initializingASetDocument, isSetProperty)

  const host = this
  // Add localization init stuff here.
  if (host.localization.enabled) {
    host.localized = true

    let inDocumentArray = false,
        localeParent = root.findNode('locales') || root.addProperty({
          name: 'locales',
          label: 'Locales',
          type: 'Document',
          optional: true,
          writable: true,
          readable: true,
          readAccess: acl.Inherit,
          writeAccess: acl.Inherit,
          deferWrites: true // so concrete document array elements can be written first.
        })

    this.addDependency('locales.' + this.fullpath)

    if (parent !== root) {

      const { name, label, uniqueKey, array } = parent

      inDocumentArray = array

      // don't allow any direct manipulation of the parent document inside the localization.
      localeParent = localeParent.findNode(name) || localeParent.addProperty({
        name: name,
        label: label,
        type: 'Document',
        readAccess: acl.Inherit,
        writeAccess: acl.Inherit,
        acl: acl.Inherit,
        writable: true,
        canPush: true,
        canPull: true,
        array,
        uniqueKey,
        writeOnCreate: false,
        writer: !array ? null : function(ac, node) {
          throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'Localized parent documents cannot be directly manipulated.', path: node.fqpp })
        },
        pusher: !array ? null : function(ac, node) {
          throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'Localized parent documents cannot be directly manipulated.', path: node.fqpp })
        },
        puller: !array ? null : function(ac, node) {
          throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'Localized parent documents cannot be directly manipulated.', path: node.fqpp })
        },
        remover: function(ac, node) {
          throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'Localized parent documents cannot be directly manipulated.', path: node.fqpp })
        }
      })

      if (array) {

        const _onRemovingValue = parent._onRemovingValue,
              _onValueAdded = parent._onValueAdded

        parent._onRemovingValue = function(ac, node, value, index) {

          let localizedArray = pathTo(ac.subject, localeParent.docpath),
              localizedDoc = findIdInArray(localizedArray, '_id', value)

          if (localizedDoc) {
            localeParent._doRemoveDocument(ac, ac.subject, value)
          }

          if (_onRemovingValue) {
            _onRemovingValue.call(this, ac, node, value, index)
          }
        }

        parent._onValueAdded = function(ac, node, value, previous, index) {
          findLocalizedParentDocument(ac, node, localeParent, value, inDocumentArray, true)
          if (_onValueAdded) {
            _onValueAdded.call(this, ac, node, value, previous, index)
          }
        }

        if (uniqueKey) {
          let uniqueNode = this.findNode(uniqueKey)
          if (!uniqueNode) {
            throw Fault.create('cortex.notFound.propertyNode', { reason: 'Unique key node not found.', path: parent.fqpp })
          }
          localeParent.findNode(uniqueKey) || localeParent.addProperty({
            name: uniqueKey,
            label: uniqueNode.label,
            type: uniqueNode.getTypeName(),
            readAccess: acl.Inherit,
            writeAccess: acl.Inherit,
            readable: true,
            writable: true, // only writable for exports sake.
            array: false,
            writer: function() {
              return Undefined
            },
            validators: [{
              name: 'uniqueInArray'
            }]
          })
          this.addDependency(`locales.${name}._id`)
          this.addDependency(`locales.${name}.${uniqueKey}`)
        }

      }

    }

    const {
            array, name, label, history, validators, auditable, readable, removable, writable,
            canPush, canPull, writeOnCreate, readAccess, writeAccess
          } = host,
          localizedProperty = localeParent.addProperty({
            name,
            label,
            type: 'Document',
            array: true,
            readable,
            removable,
            maxItems: -1,
            writable: false,
            canPush: true,
            canPull: true,
            acl: this.localization.acl,
            aclOverride: this.localization.aclOverride,
            readAccess: this.localization.readAccess,
            writeAccess: this.localization.writeAccess,
            uniqueKey: 'locale',
            properties: [{
              _id: host._id, // for history/audit.
              name: 'locale',
              label: 'Locale',
              type: 'String',
              array: false,
              history,
              auditable,
              creatable: true,
              acl: [acl.AccessLevels.Read, acl.AccessLevels.Update],
              scoped: false,
              validators: [{
                name: 'required'
              }, {
                name: 'locale',
                definition: {
                  locales: this.localization.valid.length ? this.localization.valid : []
                }
              }, {
                name: 'uniqueInArray'
              }]
            }, {
              _id: host._id, // for history/audit.
              name: 'value',
              label: 'Value',
              type: 'File',
              acl: [acl.AccessLevels.Read, acl.AccessLevels.Update],
              scoped: false,
              writable,
              array,
              history,
              auditable,
              validators,
              canPush,
              canPull,
              writeOnCreate,
              readAccess,
              writeAccess,
              onValueAdded: function(ac, node) {
                const localizedHost = (pathTo(node, 'parent.localizedHost') || localizedProperty.localizedHost)
                localizedHost._checkShouldReIndex(ac, this)
              },
              onRemovingValue: function(ac, node) {
                const localizedHost = (pathTo(node, 'parent.localizedHost') || localizedProperty.localizedHost)
                localizedHost._checkShouldReIndex(ac, this)
              },
              writer: function(ac, node, value) {

                // @todo 'fix' if there's a default value and it's not yet in the array.

                // node.localizedHost.markModified()?
                // might not trigger indexing?
                const localizedHost = (pathTo(node, 'parent.localizedHost') || localizedProperty.localizedHost)
                localizedHost._checkShouldReIndex(ac, this)

                return value
              }
            }]
          }),
          localizedNodeValue = localizedProperty.findNode('value')

    localizedNodeValue.processors = host.processors
    localizedNodeValue.uploader = host.uploader

    host.localizedProperty = localizedProperty

    localizedProperty.localizedHost = host

    localizedProperty.addDependency(host.fullpath)

    host.getPropertyPath = (propertyPath) => {
      return propertyPath
    }

    host.reader = function(ac, node, selection) {
      if (isUsingBundles(ac.subject)) {
        return geti18nTranslatedValue.call(this, node, ac, selection)
      }

      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            localizedDoc = pathTo(parentDocument, localizedProperty.docpath),
            fallbackLocale = ac.getLocale(),
            orgDefaultLocale = ac.org.locale,
            strict = node.localization.strict,
            fallback = node.localization.fallback

      if (!localizedDoc || localizedDoc.length === 0) {
        return Undefined
      }

      let chosenLocale,
          finalLocale,
          item,
          value,
          locale,
          isArray,
          result

      chosenLocale = node.localization.fixed ||
          modules.locale.matchBestChosenLocale(
            ac,
            localizedDoc.map(({ locale }) => locale),
            ac.getLocale(true, false) || fallbackLocale // use as the wildcard default
          )

      if (!chosenLocale) {
        chosenLocale = ac.getLocale(true, false)
      }

      if (strict && !modules.locale.isValid(chosenLocale)) {
        throw Fault.create('cortex.invalidArgument.locale', { resource: ac.getResource(), reason: `${chosenLocale} is not a valid locale.` })
      }

      finalLocale = chosenLocale || fallbackLocale
      item = localizedDoc.find(v => v.locale === finalLocale)

      if (!item && fallback) {
        item = localizedDoc.find(v => v.locale === fallbackLocale) ||
            localizedDoc.find(v => v.locale === orgDefaultLocale) ||
            localizedDoc[0]
      }

      value = pathTo(item, 'value')
      locale = item && item.locale
      isArray = Array.isArray(value)
      result = (isArray ? value : [value]).map(v => fileReaderParseFacets(ac, v, node, selection, locale))

      return isArray ? result : result[0]

    }
    host.initReader()

    this.writer = function(ac, node, sources, options, callback) {
      // check if it's using i18n, and NOT write in that case
      if (isUsingBundles(ac.subject)) {
        return callback(null)
      }
      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray, (options.op === 'push' || options.mergeDocuments || inDocumentArray)),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            finalLocale = node.localization.fixed || ac.getLocale(true, false)
      localizedProperty.aclWrite(ac, parentDocument, [{ locale: finalLocale, value: sources }], { ...options, mergeDocuments: true }, err => {
        callback(err)
      })
    }

    this.remover = function(ac, node, options, callback) {
      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            localizedDoc = pathTo(parentDocument, localizedProperty.docpath),
            finalLocale = node.localization.fixed || ac.getLocale(true, false),
            localizedValue = localizedDoc && localizedDoc.find(v => v.locale === finalLocale)

      if (!localizedValue) {
        return callback(null, true)
      }

      localizedProperty._pullDocument(ac, inDocumentArray ? localizedParent : ac.subject, localizedValue._id, (err) => {
        callback(err, true)
      })
    }

    if (array) {

      this._readArrayResult = function(ac, parentDocument, value, handled, selection) {

        const docs = host.reader(ac, this, selection)

        if (docs instanceof DeferredRead) {
          return docs
        }

        return processArrayEntries(docs, selection, ac, this.fullpath)
      }

      this.pusher = function(ac, node, value, options, callback) {
        host.writer(ac, node, value, options, callback)
      }
      this.puller = function(ac, node, value, options, callback) {
        const parentDocument = findLocalizedParentDocument(ac, node, localeParent, { _id: value }, inDocumentArray),
              localizedDoc = pathTo(parentDocument, localizedProperty.docpath),
              finalLocale = node.localization.fixed || ac.getLocale(true, false),
              localizedValue = localizedDoc && localizedDoc.find(v => v.locale === finalLocale)

        if (!localizedValue) {
          return callback()
        }

        localizedProperty._removeElement(
          ac,
          parentDocument,
          localizedValue._id,
          (err) => {
            if (localizedDoc.length === 0) {
              parent._onRemovingValue(ac, localizedProperty, parentDocument._id, 0)
            }
            callback(err)

          }
        )
      }
    }

  }

  function isUsingBundles(subject) {
    return !!(subject.useBundles || subject.$model?.useBundles)
  }

  function geti18nTranslatedValue(node, ac, selection) {
    let chosenLocale = node.localization.fixed ||
      modules.locale.matchBestChosenLocale(
        ac,
        [],
        ac.getLocale(true, false) || node.localization.fallback // use as the wildcard default
      )

    if (!chosenLocale) {
      chosenLocale = ac.getLocale(true, false)
    }

    if (node.localization.strict && !modules.locale.isValid(chosenLocale)) {
      throw Fault.create('cortex.invalidArgument.locale', {
        resource: ac.getResource(),
        reason: `${chosenLocale} is not a valid locale.`
      })
    }

    const ns = node.localization.namespace ? `${node.localization.namespace}` : 'cortex',
          { fullpath } = this

    // eslint-disable-next-line one-var
    let key = node.localization.translationKey,
        uniqueKey = null

    if (!key) {
      logger.warn(`${fullpath}: translationKey not defined`)
    }

    if (node.pathParent.uniqueKey) {
      // instance object
      const uniqueKeyNode = node.pathParent.findNode(node.pathParent.uniqueKey)

      if (uniqueKeyNode) {
        if (uniqueKeyNode.getTypeName() === 'UUID') {
          uniqueKey = uniqueKeyNode.stringify(
            uniqueKeyNode.castToBuffer(
              pathTo(this, node.pathParent.uniqueKey) || pathTo(selection.parentDocument, node.pathParent.uniqueKey)
            ))
            .toLowerCase()
        }
      }
      if (!uniqueKey) {
        uniqueKey = pathTo(this, node.pathParent.uniqueKey)
      }
    }
    key = `${[uniqueKey, key].filter(e => !!e).join('.')}`

    return new DeferredTranslatedFile(
      node,
      ac,
      { key, locale: chosenLocale, namespace: ns, fullpath },
      selection,
      null
    )

  }

  function findLocalizedParentDocument(ac, node, localeParent, parentDocument, inDocumentArray, create = false) {

    let localizedDoc

    if (inDocumentArray) {

      let localizedArray = pathTo(ac.subject, localeParent.docpath)
      if (!Array.isArray(localizedArray) && create) {
        pathTo(ac.subject, localeParent.docpath, [])
        localizedArray = pathTo(ac.subject, localeParent.docpath)
      }

      if (localizedArray) {

        const uniqueKeyNode = localeParent.uniqueKey && localeParent.findNode(localeParent.uniqueKey),
              uniqueKey = uniqueKeyNode && pathTo(parentDocument, localeParent.uniqueKey),
              castUniqueKey = uniqueKey && uniqueKeyNode.castForQuery(ac, uniqueKey)

        if (castUniqueKey) {
          localizedDoc = localizedArray.find(v => uniqueKeyNode.equals(v && v[localeParent.uniqueKey], castUniqueKey))
        }
        if (!localizedDoc) {
          localizedDoc = findIdInArray(localizedArray, '_id', parentDocument._id)
        }
        if (!localizedDoc && (create || parentDocument.isNew)) {
          if (castUniqueKey) {
            localizedArray.push({ _id: parentDocument._id, [localeParent.uniqueKey]: castUniqueKey })
          } else {
            localizedArray.push({ _id: parentDocument._id })
          }
          localizedDoc = findIdInArray(localizedArray, '_id', parentDocument._id)
        }
      }

    } else {

      localizedDoc = pathTo(ac.subject, localeParent.docpath)

    }

    return localizedDoc
  }

  // this stuff is all non-readable, so add deps to ensure everything is loaded.
  let dependencies = ['pid', 'creator', 'facets', 'sources']
  if (this.array) {
    dependencies.push('_id')
  }
  for (let i = 0; i < dependencies.length; i++) {
    this.addDependency('.' + this.docpath + '.' + dependencies[i])
  }
  return true

}

FileDefinition.prototype.initReader = function() {
  this._compiledReader = this.reader
}

FileDefinition.prototype.assertPayloadValueIsSane = function(ac, value) {
  if (!utils.isPlainObject(value)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'object payload expected for path ' + this.fullpath, path: this.fullpath })
  }
}

FileDefinition.prototype._readSingleResult = function(ac, parentDocument, result) {

  // pointers can be returned from a reader.
  if (modules.storage.isPointer(result)) {
    return result
  }
  // cannot read into file. just return the whole thing.
  return result

}

FileDefinition.prototype._removeProperty = function(ac, parentDocument, callback) {
  return PropertyDefinition.prototype._removeProperty.call(this, ac, parentDocument, callback)
}

FileDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  selections['facets'] = true // select all facets.

  // always allow any sub path. in this case, just select all dependencies at this level.
  DocumentDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, null, options)

}

FileDefinition.prototype._writeArrayValues = function(ac, parentDocument, array, options, callback) {

  if (ac.option('$refreshingUpload')) {
    return callback()
  }

  DocumentDefinition.prototype._writeArrayValues.call(this, ac, parentDocument, array, options, callback)

}

FileDefinition.prototype._writeSingleValue = function(ac, parentDocument, value, options, callback) {

  if (ac.option('$refreshingUpload')) {
    return callback()
  }

  // write the file object as created using the writer.
  PropertyDefinition.prototype._writeSingleValue.call(this, ac, parentDocument, value, options, callback)

}

FileDefinition.prototype.castForQuery = function(ac, value) {
  throw Fault.create('cortex.invalidArgument.castError', { resource: ac.getResource(), reason: 'Could not cast "' + value + '" to File.', path: this.fullpath })
}

/**
 * @param ac
 * @param document
 * @param sources
 *      { content: 'Image0.png', overlay: 'Overlay0.png' },
 *      { content: pointer , overlay: 'Overlay0.png' }
 *      "MyFile.png" -> {content: "MyFile.png"}
 *      "507f1f77bcf86cd799439011" -> {content: {facet: "507f1f77bcf86cd799439011"}}
 * @param existingFile
 * @param callback -> err, fileType
 */
FileDefinition.prototype.sourcesToFileType = function(ac, document, sources, existingFile, callback) {

  if (_.isString(sources)) {
    if (utils.isIdFormat(sources) || utils.isId(sources)) {
      sources = { content: { facet: utils.getIdOrNull(sources) } }
    } else {
      sources = { content: { upload: sources } } // permit
    }
  }
  if (!utils.isPlainObject(sources)) {
    callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: this.fullpath, reason: 'file source must be a plain object' }))
    return
  }

  let self = this,
      rootDocument = modules.db.getRootDocument(document),
      sourceKeys = Object.keys(sources),
      uploadable = this.processors.filter(function(processor) { return processor.allowUpload }).map(function(processor) { return processor.name }),
      facetsIndex = utils.path(rootDocument, 'facets'),
      len,
      processors = this.processors,
      processor,
      sourceExists,
      fileId,
      pathParts,
      propertyPath,
      existingViableFacets,
      existingViable

  if (!_.isArray(facetsIndex)) {
    facetsIndex = rootDocument.facets = []
  }

  len = sourceKeys.length

  // ensure source is uploadable.
  while (len--) {
    if (!~uploadable.indexOf(sourceKeys[len])) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: '"' + sourceKeys[len] + '" is not a valid input source.' }))
      return
    }
  }

  // ensure all sources that are required have been uploaded (or already exist as facets that are in the processing or ready state.)

  // we need a fileId for the property path, so pre-assign. internal writers are allowed to set the _id.
  // pathParts looks at the parent document.
  pathParts = modules.db.definitions.getFullyMaterializedPropertyPathParts(document, document.schema.node).slice(2)
  pathParts.push(this.docpath)
  if (this.array) {
    fileId = existingFile ? existingFile._id : utils.createId()
    pathParts.push(fileId)
  }
  propertyPath = pathParts.join('.')

  // -----------------------

  existingViableFacets = !existingFile ? [] : utils.array(existingFile.facets).filter(function(facetId) {
    let facet = utils.findIdInArray(facetsIndex, 'pid', facetId)
    return facet && (facet.state === consts.media.states.processing || facet.state === consts.media.states.ready)
  }).map(function(facet) {
    return facet.name
  })

  existingViable = existingViableFacets.concat(!existingFile ? [] : utils.array(existingFile.sources).filter(function(source) {
    return source.state === consts.media.states.pending || source.state === consts.media.states.processing || source.state === consts.media.states.ready
  }).map(function(source) {
    return source.name
  }))

  len = processors.length
  while (len--) {

    processor = processors[len]
    sourceExists = !!sources[processor.name] || !!~existingViable.indexOf(processor.name)

    if (processor.required && processor.source === processor.name && !sourceExists) {
      callback(Fault.create('cortex.notFound.missingMediaSource', { path: self.fullpath, resource: ac.getResource(), reason: 'A required source is missing: ' + processor.name }))
      return
    }

    if (processor.required) {
      try {
        processor.dependencies.forEach(function(name) {
          const dep = processors.find(processor => processor.name === name)
          if (dep) {
            if (dep.source === dep.name && !sources[dep.name] && !~existingViable.indexOf(dep.name)) {
              throw Fault.create('cortex.notFound.missingMediaSource', { path: self.fullpath, resource: ac.getResource(), reason: 'A required dependency (' + dep.name + ') is missing for facet (' + processor.name + ')' })
            }
          }
        })
      } catch (err) {
        callback(err)
        return
      }
    }

  }

  async.mapSeries(sourceKeys, function(key, callback_) {

    function callback(err, info) {
      // initial check against the mime type of the source.
      if (!err) {
        const processor = self.processors.find(processor => processor.name === info.name)
        if (processor && !processor.isSelectedMime(info.mime)) {
          err = Fault.create('cortex.unsupportedMediaType.facetMime', { path: self.fullpath, resource: ac.getResource(), reason: info.name + ' (' + info.filename + ') does not match allowed mime types' })
        }
      }
      callback_(err, info)
    }

    function handleExistingPointerSource(source, filename = null) {
      if (source.deleteOnDispose) {
        callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'ephemeral media cannot be used as input source' }))
      } else {
        source.info(function(err, info) {
          if (!err && info) {
            info.name = key
            if (filename !== null) {
              info.filename = filename
            }
          }
          callback(err, info)
        })
      }
    }

    if (!~uploadable.indexOf(key)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'invalid input source' }))
    }

    // normalize the source to {object, filename, source}
    const input = normalizeSource(sources[key])

    if (!input) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'invalid media source' }))
    } else if (modules.storage.isPointer(input)) {
      return handleExistingPointerSource(input)
    }

    switch (input.source) {

      case 'buffer': {

        const processor = _.find(self.processors, function(processor) { return processor.name === key })

        if (!ac.org.configuration.allowBufferSources && !ac.option(`$${self.fqpp}.allowBufferSources`)) {

          callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'invalid media source' }))

        } else if (!processor) {

          callback(Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'The source processor is missing.' }))

        } else {

          Promise.resolve(null)
            .then(async() => {

              let pointer
              try {
                const bufPointer = new modules.storage.BufferPointer(null, { buffer: input.buffer }, ac),
                      mimeType = input.mime || await promised(bufPointer, 'getMime'),
                      uploadStream = await promised(bufPointer, 'stream'),
                      { Upload } = modules.db.models,
                      uploadAc = await promised(Upload, 'createUpload', ac.principal, uploadStream, input.filename, mimeType, null, processor)

                pointer = await promised(Upload, 'aclReadPath', ac.principal, uploadAc.subject._id, 'dataFile.content', { scoped: ac.scoped })
                handleExistingPointerSource(pointer, input.filename)

              } catch (err) {
                callback(err)
              }

            })

        }

      }
        break

      case 'upload': {

        const processor = _.find(self.processors, function(processor) { return processor.name === key })
        if (!processor) {
          callback(Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'The source processor is missing.' }))
        } else {

          const pointer = modules.storage.AwsS3UploadPointer.generate(ac, self, rootDocument, propertyPath, key, input.filename, processor.maxFileSize, mime.lookup(input.filename, 'application/octet-stream')),
                info = pointer.info()
          callback(null, info)
        }
        break
      }

      case 'facet': {

        const pathParts = normalizeObjectPath(String(input.path).replace(/\//g, '.')).split('.') // :object/:id/:fullPath
        ac.org.createObject(pathParts[0], (err, object) => {
          if (err) {
            callback(err)
          } else {
            object.aclReadPath(ac.principal, pathParts[1], pathParts.slice(2).join('.'), { scoped: ac.scoped }, (err, result) => {
              if (err) {
                callback(err)
              } else if (!modules.storage.isPointer(result)) {
                callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'input source is not a file facet.' }))
              } else {
                handleExistingPointerSource(result, input.filename)
              }
            })
          }
        })
        break
      }

      default:

        callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'invalid media source' }))
        break

    }

  }, function(err, sources) {

    if (err) return callback(err)

    let file, facet, facets, arr, len, processor, source, depMatched

    sources = utils.array(sources)

    // initialize new/updated facets.
    facets = []; len = self.processors.length
    while (len--) {

      processor = self.processors[len]
      facet = findEntry(processor.name, facets)
      if (facet) {
        continue
      }
      source = _.find(sources, function(processor, source) { return source.name === processor.name }.bind(null, processor))

      if (processor.required) {

        depMatched = !!(source || ~existingViable.indexOf(processor.name))

        if (!source) {
          // look in the dependency chain to make sure it's covered by the sources.
          let deps = processor.dependencies
          for (let i = 0; i < deps.length; i++) {
            source = _.find(sources, function(dep, source) { return source.name === dep }.bind(null, deps[i]))
            if (source) {
              depMatched = true
              break
            }
            if (~existingViable.indexOf(deps[i])) {
              depMatched = true
              break
            }
          }
        }
        if (!depMatched) {
          return callback(Fault.create('cortex.notFound.missingMediaSource', { path: self.fullpath, resource: ac.getResource(), reason: 'A required source is missing: ' + processor.name }))
        }
      } else if (!processor.passMimes) {
        if (source && !processor.isSelectedMime(source.mime)) {
          return callback(Fault.create('cortex.unsupportedMediaType.facetMime', { path: self.fullpath, resource: ac.getResource(), reason: source.name + ' (' + source.filename + ') does not match allowed mime types for facet' }))
        }
      }

      // create facets for new sources only and for required facets where no existing facet exists (some might still be viable from the existing file).
      if (source || (processor.required && !~existingViableFacets.indexOf(processor.name))) {
        facet = {
          pid: utils.createId(),
          label: processor.label,
          name: processor.name,
          filename: utils.option(source, 'filename', ''),
          location: processor.location,
          storageId: processor.storageId,
          private: processor.private,
          state: consts.media.states.pending,
          creator: ac.principalId
        }
      }

      // add facets that don't exist but depend on facets that now exist and can be generated.
      if (!facet) {
        if (processor.dependencies.length > 0) {
          if (!findEntry(processor.name, facets)) {
            // are all dependencies met?
            if (_.intersection(processor.dependencies, facets.map(function(facet) { return facet.name })).length === processor.dependencies.length) {
              facet = {
                pid: utils.createId(),
                label: processor.label,
                name: processor.name,
                filename: '',
                location: processor.location,
                storageId: processor.storageId, // until property support
                private: processor.private,
                state: consts.media.states.pending,
                creator: ac.principalId
              }
            }

          }
        }
      }

      // add facets that can generated because there is a new overlay source.
      if (!facet && processor.overlay && ~existingViableFacets.indexOf(processor.source)) {
        if (findEntry(processor.overlay, facets)) {
          facet = {
            pid: utils.createId(),
            label: processor.label,
            name: processor.name,
            filename: '',
            location: processor.location,
            storageId: processor.storageId, // until property support
            private: processor.private,
            state: consts.media.states.pending,
            creator: ac.principalId
          }
        }
      }

      // if we added a facet start from scratch to detect other possible facet additions.
      if (facet) {
        facets.push(facet)
        len = self.processors.length
      }

    }

    if (facets.length === 0) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Nothing to do.' }))
    }

    file = createFile(ac, self, {
      creator: existingFile ? existingFile.creator : ac.principalId, // existing file creator won't change, though the content facet creator might.
      facets: facets,
      sources: sources
    })
    if (fileId) {
      file._id = fileId
    }

    // if there is an existing file, add any existing sources and facets that are not present in the new file object.
    if (existingFile) {

      let newFacetNames = file.facets.map(function(v) { return v.name }),
          newSourceNames

      arr = (existingFile.facets || (existingFile.facets = [])); len = arr.length
      while (len--) {
        facet = utils.findIdInArray(facetsIndex, 'pid', arr[len])
        if (facet && !~newFacetNames.indexOf(facet.name)) {
          file.facets.push(facet)
        }
      }
      newSourceNames = utils.array(file.sources).map(function(v) { return v.name })
      arr = (existingFile.sources || (existingFile.sources = [])); len = arr.length
      while (len--) {
        if (!~newSourceNames.indexOf(arr[len].name)) {
          file.sources.push(arr[len])
        }
      }
    }

    callback(err, file)

  })

}

FileDefinition.prototype.processFile = function(ac, theDocument, propertyPath, theFile, uploadId, uploadFileName, callback) {

  let self = this,
      uploadError = null,
      scanError = null

  async.waterfall([
    // upload and scan
    function(callback) {
      let upload = _.find(utils.array(theFile.sources), function(source) {
            return utils.equalIds(source.pid, uploadId)
          }),
          tries = 0,
          maxTries = 3,
          document = theDocument

      if (!upload) {
        return callback()
      }

      if (upload.scanned || !config('services.viruscan.scan_uploads')) {
        return callback()
      }

      const uploadPointer = modules.storage.create(self, upload, ac),
            processor = self.processors.find(p => p.name === upload.name)

      async.whilst(

        () => tries < maxTries,

        callback => {

          // get a stream.
          async.retry({
            times: 3,
            interval: function(retryCount) {
              return 40 * Math.pow(3, retryCount)
            }
          }, callback => {
            uploadPointer.stream((err, stream) => {
              callback(err, stream)
            })
          }, (err, stream) => {

            if (err) {
              uploadError = err
              return callback(err)
            }

            if (processor && processor.skipVirusScan) {
              tries = maxTries
              scanError = null
              return callback()
            }

            // attempt to scan.
            const begin = new Date(),
                  req = modules.services.get('viruscan').post('/scan', (err, result) => {

                    if (!err && _.isString(result)) {
                      err = Fault.create('cortex.error.virusDetected', { resource: ac.getResource(), reason: result })
                    }

                    tries++
                    upload.scanned = true

                    logger.silly(`Scanned upload to property ${propertyPath} in ${document.object} with identifier ${document._id}`, err ? err.toJSON() : 'Ok')

                    if (err && err.errCode === 'cortex.error.virusDetected') {
                      tries = maxTries
                      if (config('services.viruscan.allow_infected_scans')) {
                        err = null
                      } else {
                        err.reason = `Virus "${err.reason}" detected.`
                        err.path = `${document.constructor.pluralName}/${document._id}/${propertyPath.replace(/\./g, '/')}`
                      }
                      scanError = err
                      return callback(err)
                    }

                    if (!err) {
                      tries = maxTries
                      const LogModel = modules.db.models.Log,
                            log = new LogModel({
                              req: ac.reqId || utils.createId(),
                              org: ac.orgId,
                              beg: begin,
                              end: new Date(),
                              src: consts.logs.sources.api,
                              in: 0,
                              out: 0,
                              pid: ac.principalId,
                              oid: ac.option('originalPrincipal') || ac.principalId,
                              exp: new Date(Date.now() + (86400 * 1000 * 30)),
                              lvl: consts.logs.levels.info,
                              ops: 0,
                              ctt: 0,
                              cms: 0,
                              dat: {
                                message: `Viruscan completed. No viruses detected.`,
                                path: `${document.constructor.pluralName}/${document._id}/${propertyPath.replace(/\./g, '/')}`
                              }
                            })
                      log.err = undefined
                      LogModel.collection.insertOne(log.toObject(), () => {})

                    } else if (tries < maxTries) {
                      err = null
                    }

                    if (err) {
                      scanError = err
                      return callback(err)
                    }
                    setTimeout(callback, 100 * Math.pow(2, tries))

                  })

            stream.pipe(req)

          })

        },
        err => {
          if (err) {
            if (err.errCode !== 'cortex.error.virusDetected') {
              logger.error(`Virus scan failed to complete in org "${ac.org.code}" upload to property ${propertyPath} in ${document.object} with identifier ${document._id}`, err.toJSON())
              if (config('services.viruscan.allow_failed_scans') && err.errCode !== 'cortex.error.virusDetected') {
                scanError = null
                const LogModel = modules.db.models.Log,
                      log = new LogModel({
                        req: ac.reqId || utils.createId(),
                        org: ac.orgId,
                        beg: new Date(),
                        end: new Date(),
                        src: consts.logs.sources.api,
                        in: 0,
                        out: 0,
                        pid: ac.principalId,
                        oid: ac.option('originalPrincipal') || ac.principalId,
                        exp: new Date(Date.now() + (86400 * 1000 * 30)),
                        lvl: consts.logs.levels.warn,
                        ops: 0,
                        ctt: 0,
                        cms: 0,
                        dat: {
                          message: `Viruscan failed to complete.`,
                          path: `${document.constructor.pluralName}/${document._id}/${propertyPath.replace(/\./g, '/')}`
                        }
                      })
                log.err = undefined
                LogModel.collection.insertOne(log.toObject(), () => {})
              }
            }
          }

          callback()
        }
      )
    },
    // if there is an upload, attempt to update it to a ready state.
    function(callback) {
      if (!uploadId) {
        return callback(null, theDocument, null, theFile)
      }

      modules.db.sequencedFunction(atomicUpdate.bind(null, ac, theDocument, propertyPath, self, function(ac, document, propertyPath, fileContainer, file, callback) {

        let upload = _.find(utils.array(file.sources), function(source) {
          return utils.equalIds(source.pid, uploadId)
        })

        if (!upload) {
          return callback()
        }

        if (scanError || uploadError) {
          upload.state = consts.media.states.error
          upload.fault = (Fault.from((scanError || uploadError)) || (scanError || uploadError)).toJSON()
        } else if (upload.state !== consts.media.states.ready) {
          upload.state = consts.media.states.ready
          delete upload.fault
        }
        callback()

      }), 20, (err, document, fileContainer, file) => {
        if (err) {
          const facet = toArray(pathTo(file, 'sources')).find(source => source && equalIds(source.pid, uploadId))
          triggerAfterProcessScript(err, ac, self, document || theDocument, propertyPath, fileContainer, file, facet)
        }
        callback(err, document, fileContainer, file)

      })

    },

    // process facets one by one.
    function(document, fileContainer, file, callback) {

      // while there are any facets that can be processed, attempt to process. if there are errors, continue
      // to process any others, if possible. keep a running list of attempts so we don't go over them twice.
      let failedFacetIds = [],
          processors = self.processors,
          currentFacet = true

      // process facets one at a time to avoid multiple worker process collisions.
      async.whilst(function() {

        return currentFacet

      }, function(callback) {

        currentFacet = null // just in case.

        async.waterfall([

          // attempt to find a facet and set it to be processing.
          function(callback) {
            modules.db.sequencedFunction(atomicUpdate.bind(null, ac, document, propertyPath, self, function(ac, document, propertyPath, fileContainer, file, callback) {
              let facet = currentFacet = findFirstProcessableFacet(ac, self, document, processors, failedFacetIds, file)
              if (facet) {
                facet.state = consts.media.states.processing
                delete facet.fault
              }
              callback(facet ? null : 'kDone') // no available facets quits.
            }), 20, callback)
          },

          // process the facet.
          function(document, fileContainer, file, callback) {

            // this instance now has a lock on this facet. process the media outside of the atomic update. store the processed media in case we fail to update.
            // if the facets on which the process depends are all the same, we can just retry the save, in order to avoid all the re-processing.
            // file processing is slow. as such, many changes might occur between processing and the actual reload and update.
            // we need to process the media, store it, and then sequence. we only have to make sure the facet sill exists in the correct state.
            async.waterfall([

              function(callback) {

                let facetsIndex = utils.array(document.facets),
                    facet,
                    processor,
                    sourcePointers
                if (utils.inIdArray(file.facets, currentFacet.pid)) {
                  facet = utils.findIdInArray(facetsIndex, 'pid', currentFacet.pid)
                  if (facet.state !== consts.media.states.processing) {
                    facet = null
                  }
                }

                if (!facet) {
                  // note: this should be unreachable.
                  logger.error('Unreachable code: !facet in processFacet()')
                  return callback('kDone') // eslint-disable-line standard/no-callback-literal
                }

                processor = _.find(processors, function(v) { return v.name === currentFacet.name })
                if (!processor) {
                  return callback(Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: self.fullpath, reason: 'processor lost during facet update' }))
                }

                sourcePointers = getReadyFacetSourcePointers(ac, self, document, file, processors, processor, false, true)

                processor.process(ac, self, sourcePointers, document, propertyPath, facet.pid, function(err, sourceErrors, pointer, originalSource) {
                  let len, wasAdded = false
                  if (err) {

                    if (pointer) {
                      pointer.dispose()
                    }

                    // caught a processing error. set it and continue.
                    failedFacetIds.push(facet.pid)
                    facet.state = consts.media.states.error
                    facet.fault = (Fault.from(err) || err).toJSON()

                    callback(null, facet, pointer, sourceErrors, wasAdded)

                  } else if (!pointer) {
                    // the processor skipped it. this is a case of passMimes. remove the facet.
                    callback(null, facet, null, [], wasAdded)
                  } else {
                    pointer.info(function(err, info) {
                      pointer.dispose()
                      if (err) {
                        failedFacetIds.push(facet.pid)
                        facet.state = consts.media.states.error
                        facet.fault = (Fault.from(err) || err).toJSON()

                      } else {
                        // swap out the existing facet, pid is preserved in processor.process()
                        facet = info; len = facetsIndex.length
                        wasAdded = true

                        while (len--) {
                          if (utils.equalIds(info.pid, facetsIndex[len].pid)) {

                            // save the original facet creator, path, and property id
                            facet.creator = facetsIndex[len].creator
                            facet._pi = facetsIndex[len]._pi
                            facet._kl = facetsIndex[len]._kl
                            facet._up = new Date()

                            // save the filename, using the new facet's mime extension.
                            const filename = originalSource.filename
                            if (filename) {
                              const extension = path.extname(filename)
                              facet.filename = `${path.basename(filename, extension)}.${mime.extension(info.mime) || 'dat'}`
                            }

                            facetsIndex[len] = facet
                            break
                          }
                        }
                      }
                      callback(null, facet, pointer, [], wasAdded)
                    })
                  }
                })
              }

            ], function(err, modifiedFacet, sourcePointer, sourceErrors, wasAdded) {

              if (err) {
                return callback(err) // an error occurred that requires a retry of the message.
              } else {

                modules.db.sequencedFunction(atomicUpdate.bind(null, ac, document, propertyPath, self, function(ac, document, propertyPath, fileContainer, file, callback) {

                  let existing, facetPos, facetsIndex = utils.array(document.facets)

                  // ensure changes made to the document did not destroy the modified facet.
                  // swap out the existing facet, pid is preserved in processor.process()
                  if (utils.inIdArray(file.facets, modifiedFacet.pid)) {
                    facetPos = utils.findIdPos(facetsIndex, 'pid', modifiedFacet.pid)
                    if (~facetPos && facetsIndex[facetPos].state === consts.media.states.processing) {
                      existing = facetsIndex[facetPos] = modifiedFacet
                    }
                  }

                  if (existing && !sourcePointer && !sourceErrors.length && modifiedFacet.state !== consts.media.states.error) {

                    // the processor skipped it. this is a case of passMimes. remove the facet.
                    let len = file.facets.length
                    while (len--) {
                      if (utils.equalIds(modifiedFacet.pid, file.facets[len])) {
                        file.facets.splice(len, 1)
                        break
                      }
                    }
                    len = facetsIndex.length
                    while (len--) {
                      if (utils.equalIds(modifiedFacet.pid, facetsIndex[len].pid)) {
                        facetsIndex[len]._kl = true
                        facetsIndex[len]._up = new Date()
                        break
                      }
                    }
                  } else if (!existing) {
                    // the facet no longer exists, so we should delete the original.
                    facetPos = utils.findIdPos(facetsIndex, 'pid', modifiedFacet.pid)
                    if (~facetPos) {
                      facetsIndex[facetPos]._kl = true
                      facetsIndex[facetPos]._up = new Date()
                    }
                  }

                  // update sources with errors.
                  sourceErrors.forEach(function(sourceErr) {
                    let source = findEntry(sourceErr.name, file.sources)
                    if (source) {
                      source.state = consts.media.states.error
                      source.fault = (Fault.from(sourceErr.fault) || sourceErr.fault).toJSON()
                    }
                  })

                  if (existing) {
                    processHistory(self, ac, document, propertyPath, fileContainer, file, () =>
                      callback(null)
                    )
                  } else {
                    callback('kDone') // eslint-disable-line standard/no-callback-literal
                  }

                }), 20, (err, document, fileContainer, file) => {

                  if (!err && wasAdded) {
                    if (modules.storage.isInternallyStoredFacet(modifiedFacet)) {
                      const { size, _pi } = modifiedFacet,
                            { object, type } = document,
                            { Stat } = modules.db.models

                      modules.db.models.Stat.addRemoveFacet(ac.orgId, Stat.getDocumentSource(document), object, type, _pi, 1, size)
                    }
                  }
                  triggerAfterProcessScript(err, ac, self, document, propertyPath, fileContainer, file, modifiedFacet)

                  callback(err, document, fileContainer, file)

                })

              }

            })

          }

        ], function(err, document, fileContainer, file) {

          // attempt to set an error on the facet.
          if (err && err !== 'kDone' && currentFacet) {
            failedFacetIds.push(currentFacet.pid)
            modules.db.sequencedFunction(atomicUpdate.bind(null, ac, document, propertyPath, self, function(ac, document, propertyPath, fileContainer, file, callback) {

              let facet, facetsIndex = utils.array(document.facets)
              if (utils.inIdArray(file.facets, currentFacet.pid)) {
                facet = utils.findIdInArray(facetsIndex, 'pid', currentFacet.pid)
                if (facet && facet.state === consts.media.states.processing) {
                  facet.state = consts.media.states.error
                  facet.fault = (Fault.from(err) || err).toJSON()
                }
              }
              callback(facet ? null : 'kDone') // no available facet just skips.
            }), 20, function() {
              callback(err) // using scoped error.
            })
            return
          }

          // find another facet to process.
          if (!err) {
            theDocument = document // reset the top-level document.
            theFile = file
            currentFacet = findFirstProcessableFacet(ac, self, document, processors, failedFacetIds, file)
          }

          callback(err)

        })

      }, callback)
    },

    // nothing left available to process. check if sources can be cleaned up.
    function(callback) {

      modules.db.sequencedFunction(atomicUpdate.bind(null, ac, theDocument, propertyPath, self, function(ac, document, propertyPath, fileContainer, file, callback) {

        let facetsIndex = utils.array(document.facets),
            finished = _.every(file.facets, function(facetId) {
              let facet = utils.findIdInArray(facetsIndex, 'pid', facetId)
              return !facet || facet.state === consts.media.states.ready
            })

        // if every facet is ready, the matching source pointers can be deleted. the save might not happen correctly, but these are ok to delete.
        if (finished) {
          utils.array(file.sources).forEach(function(source) {
            let pointer = modules.storage.create(self, source, ac)
            if (pointer && pointer.isUploadPointer()) {
              pointer.delete()
            }
          })
          file.sources = []
          callback(null)

        } else {
          callback('kDone') // eslint-disable-line standard/no-callback-literal
        }

      }), 20, callback)

    }

  ], function(err) {

    if (err === 'kDone') err = null // short-circuit to allow message to succeed if the document can't be found (no longer exists).
    callback(err)
  })

}

function processArrayEntries(docs, selection, ac, fullpath) {

  let hasPlainKeys = false, i, index, doc, path, seen = new Set(), entries = []

  // see if there are any ids or array indices. if so, ONLY those documents will be read if the reader is passive, meaning explicit paths from all other documents
  // were not requested. for example, stuff.0.thing + stuff.bar means only get thing from idx 0 but get bar from all stuff docs.
  for (i = 0; i < selection.keys.length; i++) {
    path = selection.keys[i]
    if (utils.isIdFormat(path)) {
      doc = utils.findIdInArray(docs, '_id', path)
      if (!doc) {
        throw Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: `${fullpath}${fullpath ? '.' : ''}${path}` })
      } else if (seen.has(doc)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: `${fullpath}${fullpath ? '.' : ''}${path}`, reason: 'Cannot mix _id and index lookups on the same document.' })
      } else {
        index = docs.indexOf(doc)
        seen.add(doc._id)
        entries.push({ doc, index })
      }

    } else if (utils.isInteger(path)) {

      index = parseInt(path)
      if (index < 0) index = docs.length + index // support negative indexes
      doc = docs[index]
      if (!doc) {
        throw Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: `${fullpath}${fullpath ? '.' : ''}${path}` })
      } else if (seen.has(doc)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: `${fullpath}${fullpath ? '.' : ''}${path}`, reason: 'Cannot mix _id and index lookups on the same document.' })
      } else {
        seen.add(doc._id)
        entries.push({ doc, index })
      }
    } else {
      hasPlainKeys = true
    }
  }

  // if we have indexed or id lookup and are passive, it means we're not going to select any more documents
  if (hasPlainKeys || selection.passive) {
    for (i = 0; i < docs.length; i++) {
      doc = docs[i]
      if (!seen.has(doc._id)) {
        entries.push({ doc, index: i })
      }
    }
  }

  return entries
    .sort((a, b) => a.index - b.index)
    .map(v => v.doc)
    .filter(v => v)

}

function processHistory(node, ac, document, propertyPath, fileContainer, file, callback) {

  // no support for legacy objects.
  if (['post', 'comment'].includes(document && document.constructor && document.constructor.objectName)) {
    return callback()
  }

  const historyAc = ac.copy(document),
        parentDoc = modules.db.getParentDocument(fileContainer)

  node._checkShouldRecordHistory(historyAc, parentDoc, file, file, null, consts.history.operations.set)
  historyAc.apiHooks.fire(document, 'save.before', null, { ac: historyAc, modified: [] }, () => callback())

}

function createFile(ac, node, arg) {

  let creator = utils.isIdFormat(arg) ? utils.getIdOrNull(arg) : null
  if (creator) {
    return {
      creator: creator,
      facets: utils.array(arguments[1]),
      sources: []
    }
  }
  if (!arg) throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'expecting raw or creator' })
  if (!utils.isId(arg.creator)) throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'expecting files creator' })
  if (!_.isArray(arg.facets)) throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'expecting facets array' })
  return {
    creator: arg.creator,
    facets: utils.array(arg.facets),
    sources: utils.array(arg.sources)
  }

}

function fileReader(ac, node, selection) {
  let file = node.array ? this : utils.path(this, node.docpath)
  return fileReaderParseFacets(ac, file, node, selection)
}

function fileReaderParseFacets(ac, file, node, selection, locale = null, bundleDocument = null) {
  // attempting to read inside the file? allow limited virtual updates inside the path.
  if (ac.propPath) {

    let reqpath = ac.propPath,
        filepath = reqpath.indexOf(node.fullpath) !== 0 ? '' : reqpath.substr(node.fullpath.length + 1),
        fileparts = filepath.split('.')

    if (filepath) {
      // reading from a refresh? send back updated uploads.
      if (ac.method === 'put' && filepath === 'refresh' && file) {
        let uploads = utils.array(utils.path(ac, 'req.body'), true).reduce(function(uploads, descriptor) {
          let upload = _.find(utils.array(file.sources), function(upload) {
            return upload.name === descriptor
          })
          if (upload) {
            let pointer = modules.storage.create(node, upload, ac)
            if (pointer) {
              let info = pointer.aclRead(ac.principal)
              if (info) {
                uploads.push(info)
              }
            }
          }
          return uploads
        }, [])
        return utils.path({}, 'refresh', uploads, true)
      }

      // streaming a facet? internals may not have a c_ name, so guess at the intent.
      if (fileparts.length === 1 && _.isString(fileparts[0])) {

        // if we're reading all items from an array, do not return a facet.
        // instead, only return facets if we're sure the caller won't dig into a resolved array.
        // files do not current support unique keys so it's safe to look in here
        // and ensure the last element in the path is indeed an object id or an array index.
        let isSinglePath = true
        if (node.array && ac.singlePath) {
          const part = ac.singlePath.split('.').reverse()[1]
          isSinglePath = (utils.isIdFormat(part) || utils.isInteger(part))
        }
        const facetname = fileparts[0]
        if (utils.isIdFormat(facetname) || facetname.indexOf('c_') === 0 || ~facetname.indexOf('__') || ~CommonInternalFacetNames.indexOf(facetname) || _.find(node.processors, function(p) { return p.name === facetname })) {
          if (file) {
            const pointer = modules.storage.accessPointer(bundleDocument || ac.document, node, file, facetname, ac)
            if (isSinglePath) {
              return { [facetname]: pointer }
            } else {
              return { [facetname]: new DeferredPointerRead(node, ac, { pointer, locale }, selection, null) }
            }
          }
          throw Fault.create('cortex.notFound.file', { path: node.fullpath, reason: 'The file does not exist.', resource: ac.getResource() })
        }

      }
    }
  }

  // merge the content facet info in with the file pid. the fileId and content facet id should match.
  if (file) {

    let out = {
          creator: file.creator
        },
        facetsIndex = utils.array(utils.path(bundleDocument || ac.document, 'facets')),
        facets = [],
        pidPropertyName = ac.option('Read_File_Pids_As'),
        sources = []

    // only add data if there's a content facet. if not, allow doc reader to cull {}
    if (file.creator) {
      if (locale) {
        out.locale = locale
      }
    }
    if (node.array) {
      out._id = file._id
    }

    utils.array(file.facets).forEach(function(facetId) {

      let facet = utils.findIdInArray(facetsIndex, 'pid', facetId)

      if (facet) {
        let pointer = modules.storage.create(node, facet, ac)
        if (pointer) {

          facet = pointer.aclRead(ac.principal)
          if (facet) {
            // could be reading from plain object.
            // let filePathParts = modules.db.definitions.getFullyMaterializedPropertyPathParts(file, node, null);
            // if (filePathParts.length) {
            //     facet.path = '/' + filePathParts.join('/').replace(/\./g, '/') + '/' + facet.name;
            // }
            facet.path = `${ac.readThroughPath || ''}/${ac.getPath('/')}/${facet.name}`
            facet.resource = `${ac.getResource()}.${facet.name}`

            let url = Undefined
            if (facet.state === consts.media.states.ready) {
              url = new DeferredUrlRead(node, ac, { pointer, locale }, selection, null)
            }
            if (facet.name === 'content') {
              utils.extend(out, facet) // except the creator! which remains the initial file structure creator.
              out.creator = file.creator
              if (url) out.url = url
              if (pidPropertyName) out[pidPropertyName] = facetId

            } else {
              if (facet) facet.url = url
              if (pidPropertyName) facet[pidPropertyName] = facetId
              facets.push(facet)
            }

          }
        }
      }
    })
    if (facets.length > 0) {
      out.facets = facets
    }

    utils.array(file.sources).forEach(function(source) {
      if (utils.equalIds(ac.principalId, source.creator)) {
        let pointer = modules.storage.create(node, source, ac)
        if (pointer && pointer.isUploadPointer()) { // only show pointers the client needs to see.
          source = pointer.aclRead(ac.principal)
          if (source) {
            sources.push(source)
          }
        }
      }
    })
    if (sources.length > 0) {
      out.uploads = sources
    }

    return out

  }
  return undefined
}

function docWriter(ac, node, sources, options, callback) {

  let existingFile,
      doc = this

  if (node.array) {
    existingFile = utils.findIdInArray(utils.path(this, node.docpath), '_id', utils.path(sources, '_id'))
  } else {
    existingFile = utils.path(this, node.docpath)
    if (existingFile) {
      // check for "empty" file (new with no properties.)
      if (Object.values(existingFile.toObject()).every(v => v === Undefined)) {
        existingFile = null
      }
    }
  }

  // allow limited facet manipulation.
  if (ac.propPath) {

    let err,
        reqpath = ac.propPath,
        filepath = reqpath.indexOf(node.fullpath) !== 0 ? '' : reqpath.substr(node.fullpath.length + 1),
        updates = utils.array(utils.path(sources, 'refresh'), true)

    if (filepath) {

      if (!existingFile || filepath !== 'refresh' || ac.method !== 'put') {
        err = Fault.create('cortex.unsupportedOperation.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Illegal File update. Only PUT + /refresh supported, and only on an existing file.' })
      } else {
        err = updates.reduce(function(err, descriptor) {

          if (err) return err

          const upload = _.find(utils.array(existingFile.sources), function(upload) {
            return upload.name === descriptor
          })
          if (!upload) return Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Upload not found for refresh: ' + descriptor })
          if (!utils.equalIds(upload.creator, ac.principalId)) return Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Uploads can only be refreshed by their creator: ' + descriptor })

          let processor = _.find(node.processors, function(processor) {
                return processor.name === upload.name
              }),
              pointer

          if (!processor) return Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Facet processor no longer present for upload refresh: ' + descriptor })

          pointer = modules.storage.create(node, upload, ac)
          if (!pointer) return Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Facet storage no longer present for upload refresh: ' + descriptor })
          if (!pointer.isUploadPointer()) return Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Upload source cannot be refreshed: ' + descriptor })

          try {
            upload.upload = pointer.refreshUpload(ac, node, this, processor.maxFileSize)
          } catch (err) {
            return err
          }
          this.markModified(node.docpath)
          ac.markSafeToUpdate(node)

          return null

        }.bind(this), null)

        // @hack issue #503, this is causing a onRemovingValue due to re-write of the file property, which in turn causes the facets to be removed.
        // set a temporary ac option to hint that we're refreshing.
        // @todo File ought to have a full definition structure.
        if (!err && updates.length) {
          ac.option('$refreshingUpload', true)
        }
      }
      return callback(err, existingFile)
    }

  }

  if (sources) delete sources._id

  node.sourcesToFileType(ac, this, sources, existingFile, (err, file) => {
    if (!err) {

      // trigger the media processor.
      const after = function() {
        const savedFile = after.getFile()
        if (savedFile) {
          const filePathParts = after.getPathParts()
          if (filePathParts.length) {
            modules.workers.send('uploads', 'media-processor', {
              org: ac.orgId,
              level: 'file',
              key: ac.orgId + '/' + after.getObjectId() + '/' + filePathParts.join('.')
            }, {
              reqId: ac.reqId,
              orgId: ac.orgId,
              force: !!ac.option('isImport')
            })
          }
        }
      }
      after.getPath = function() {
        return after.getPathParts().join('.')
      }
      after.getPathParts = function() {
        return modules.db.definitions.getFullyMaterializedPropertyPathParts(after.getFile(), node).slice(1)
      }
      after.getObjectId = function() {
        return (ac.comment || ac.post || ac.subject).constructor.objectId
      }
      after.getObjectName = function() {
        return (ac.comment || ac.post || ac.subject).constructor.objectName
      }
      after.getFile = function() {
        if (node.array) {
          return utils.findIdInArray(utils.path(doc, node.docpath), '_id', file._id)
        } else {
          return utils.path(doc, node.docpath)
        }
      }

      ac.hook('save').after(after, 'file-property-trigger-processor', false)

    }
    callback(err, file)
  })
}

function findEntry(name, sources) {
  return _.find(utils.array(sources), function(source) {
    return source.name === name
  })
}

function saveFile(ac, document, callback) {
  ac.lowLevelUpdate({ subject: document }, function(err) {
    callback(err)
  })
}

function reloadFile(ac, document, propertyPath, callback) {

  let model = document.constructor,
      select = document.schema.node.selectPaths(ac.principal, { paths: ['_id', 'org', 'object', 'type', 'facets', propertyPath] }),
      find = { _id: document._id, org: ac.orgId, reap: false }

  model.findOne(find).select(select).exec(function(err, doc) {
    let file
    if (doc) {
      file = utils.digIntoResolved(doc, propertyPath, true, true)
    }
    callback(err, doc, file)
  })

}

function findAvailableSource(name, sources) {
  return _.find(utils.array(sources), function(source) {
    return source.name === name && source.state === consts.media.states.ready
  })
}

function getReadyFacetSourcePointers(ac, node, document, file, processors, processor, onlyDependenciesAndReturnNullOnMissing, asPointers) {

  let deps = [], dep

  if (onlyDependenciesAndReturnNullOnMissing && processor.name === processor.source) {
    dep = findAvailableSource(processor.source, file.sources)
    if (dep) {
      deps.push(dep)
    } else {
      return null
    }
  } else {

    let pool = onlyDependenciesAndReturnNullOnMissing ? processor.dependencies : processors.map(function(v) { return v.name }),
        len = pool.length,
        name,
        source,
        facet,
        facetsIndex = utils.array(document.facets),
        f,
        flen

    while (len--) {

      name = pool[len]

      // note: if a source is found but is not available, skip altogether. it shows an intent to upload.
      source = findEntry(name, file.sources)
      if (source) {
        if (source.state === consts.media.states.ready) {
          deps.push(source)
          continue
        } else {
          if (onlyDependenciesAndReturnNullOnMissing) {
            return null
          }
          continue
        }
      }

      facet = null
      flen = file.facets.length
      while (flen--) {
        f = utils.findIdInArray(facetsIndex, 'pid', file.facets[flen])
        if (f && name === f.name) {
          facet = f
          break
        }
      }
      if (facet && facet.state === consts.media.states.ready) {
        deps.push(facet)
      } else if (onlyDependenciesAndReturnNullOnMissing) {
        return null
      }
    }
  }

  // if there's an overlay and it's in the sources array, it's only ok it it's ready.
  // the image processor will continue if it does not find one, and could miss anonymizing.
  if (processor.overlay) {
    dep = findEntry(processor.overlay, file.sources)
    if (dep) {
      if (dep.state === consts.media.states.ready) {
        deps = _.uniq(deps.concat(dep))
      } else {
        if (onlyDependenciesAndReturnNullOnMissing) {
          return null
        }
      }
    } else {
      dep = findEntry(processor.overlay, file.facets)
      if (dep) {
        if (dep.state === consts.media.states.ready) {
          deps = _.uniq(deps.concat(dep))
        } else {
          if (onlyDependenciesAndReturnNullOnMissing) {
            return null
          }
        }
      }
    }
  }

  if (asPointers) {
    deps = deps.map(function(dep) {
      return modules.storage.create(node, dep, ac)
    }).filter(function(v) {
      return !!v
    })
  }

  return deps
}

function findFirstProcessableFacet(ac, node, document, processors, failedFacetIds, file) {

  let facetsIndex = utils.array(document.facets),
      facetId = _.find(file.facets, function(facetId) {
        let facet = utils.findIdInArray(facetsIndex, 'pid', facetId)
        if (facet) {
          let processor = _.find(processors, function(v) {
            return v.name === facet.name
          })
          if (processor && !utils.inIdArray(failedFacetIds, facet.pid) && (facet.state === consts.media.states.pending || facet.state === consts.media.states.error)) {
            return !!getReadyFacetSourcePointers(ac, node, document, file, processors, processor, true, false)
          }
        }
      })

  return facetId ? utils.findIdInArray(facetsIndex, 'pid', facetId) : null
}

function readFacet(ac, node, facet, callback) {
  let info
  try {
    if (facet) {
      const pointer = modules.storage.create(node, facet, ac)
      if (pointer) {
        info = pointer.aclRead(ac.principal)
      }
    }
  } catch (err) {
    void err
  } finally {
    callback(info)
  }
}

function triggerAfterProcessScript(err, ac, node, document, propertyPath, fileContainer, file, facet) {

  if (err === 'kDone') {
    return
  }

  if (document && (document.object === 'post' || document.object === 'comment')) {
    return
  }

  // attempt to call as file creator
  function getFileCreator(callback) {

    const creator = (facet && facet.creator) || (file && file.creator) || ac.principal._id

    if (equalIds(creator, ac.principal._id)) {
      return callback(ac)
    }
    ap.create(ac.org, creator, (err, principal) => {
      if (err) {
        callback(ac)
      } else {
        const _ac = ac.copy(document)
        _ac.principal = principal
        callback(_ac)
      }
    })
  }

  getFileCreator(ac => {
    readFacet(ac, node, facet, facet => {
      const runtime = {
        path: propertyPath
      }
      if (err) {
        runtime.fault = Fault.from(err, false, true).toJSON()
      }
      if (facet) {
        runtime.facet = facet
      }
      modules.sandbox.triggerScript('file.process.after', ac.script, ac, { attachedSubject: document }, runtime, err => {
        void err
      })
    })
  })

}

/**
 *
 * @param ac
 * @param document
 * @param propertyPath
 * @param node
 * @param fn
 * @param callback err ("kDone" if no document or file found), document, file. Will callback with cortex.conflict.sequencing if any changes where made during 'fn'.
 */
function atomicUpdate(ac, document, propertyPath, node, fn, callback) {
  reloadFile(ac, document, propertyPath, function(err, document, file) {
    if (!err && (!document || !file)) err = 'kDone'
    if (err) {
      return callback(err)
    }

    let fileContainer = utils.digIntoResolved(document, propertyPath, true, true),
        parentDoc = modules.db.getParentDocument(fileContainer)

    if (!fileContainer || !parentDoc) {
      return callback('kDone') // eslint-disable-line standard/no-callback-literal
    }

    fn(ac, document, propertyPath, fileContainer, file, function(err) {
      if (err) {
        callback(err, null, null, null)
      } else {

        let rootDoc = modules.db.getRootDocument(parentDoc)

        ac.markSafeToUpdate(node)
        ac.markSafeToUpdate(rootDoc.schema.node.properties.facets)

        parentDoc.markModified(node.docpath)
        rootDoc.markModified('facets')

        saveFile(ac, document, function(err) {
          callback(err, document, fileContainer, file)
        })
      }
    })
  })

}

FileDefinition.prototype.onRemovingValue = function(ac, parentDocument, file, index) {

  if (ac.option('$refreshingUpload')) {
    return
  }

  let rootDocument = modules.db.getRootDocument(parentDocument),
      facetsIndex = toArray(utils.path(rootDocument, 'facets')),
      pids = getIdArray(utils.path(file, 'facets'))

  // mark all facets as deleted.
  facetsIndex.forEach(function(facet) {
    if (facet && utils.inIdArray(pids, facet.pid) && !facet._kl) {
      facet._kl = true
      facet._up = new Date()
    }
  })
  ac.markSafeToUpdate(rootDocument.schema.node.properties.facets)
  rootDocument.markModified('facets')

  PropertyDefinition.prototype.onRemovingValue.call(this, ac, parentDocument, file, index)
}

FileDefinition.prototype._addFileFacets = function(ac, parentDocument, file) {

  if (ac.option('$refreshingUpload')) {
    return
  }

  let rootDocument = modules.db.getRootDocument(parentDocument),
      facetsIndex = utils.path(rootDocument, 'facets'),
      added = [],
      propertyId = this._id

  if (rootDocument && _.isArray(facetsIndex)) {

    utils.array(utils.path(file, 'facets')).forEach(function(facet) {

      // replace if exists.
      let pos = utils.findIdPos(facetsIndex, 'pid', facet.pid)
      if (~pos) {
        facetsIndex.splice(pos, 1)
      }
      facet._pi = propertyId
      facet._kl = false
      facetsIndex.nonAtomicPush(facet)
      added.push(facet)

    })

    ac.markSafeToUpdate(rootDocument.schema.node.properties.facets)
    rootDocument.markModified('facets')

  }

  // only store the pids in the facets array.
  file.facets = file.facets.map(function(facet) {
    return facet.pid
  })

  return added

}

FileDefinition.prototype._setSingleValue = function(ac, parentDocument, value) {

  if (ac.option('$refreshingUpload')) {
    return
  }

  this._addFileFacets(ac, parentDocument, value)
  utils.path(parentDocument, this.docpath, value)

}

/**
 * low-level array index setter.
 *
 * @param ac
 * @param parentDocument
 * @param currentArray
 * @param docIdx
 * @param value
 * @private
 */
FileDefinition.prototype._setArrayValue = function(ac, parentDocument, currentArray, docIdx, value) {

  if (ac.option('$refreshingUpload')) {
    return
  }

  this._addFileFacets(ac, parentDocument, value)
  currentArray.set(docIdx, value)
}

/**
 * low-level array addToSet
 * @param ac
 * @param parentDocument
 * @param currentArray
 * @param value
 * @private
 */
FileDefinition.prototype._addToSet = function(ac) {
  throw Fault.create('cortex.notImplemented.unspecified', { resource: ac.getResource(), reason: 'uniqueValues unsupported for Files' })
}

/**
 * low-level array push
 * @param ac
 * @param parentDocument
 * @param currentArray
 * @param value
 * @private
 */
FileDefinition.prototype._pushValue = function(ac, parentDocument, currentArray, value) {

  if (ac.option('$refreshingUpload')) {
    return
  }

  this._addFileFacets(ac, parentDocument, value)
  currentArray.push(value)
}

FileDefinition.prototype.export = async function(ac, doc, resourceStream, parentPath, options) {

  const resourcePath = this.getExportResourcePath(parentPath, options),
        isLocalized = this.localization.enabled
  if (!this.isExportable(ac, doc, resourceStream, resourcePath, parentPath, options)) {
    return Undefined
  }
  // just keep locales data if localized
  if (isLocalized && this.fullpath.indexOf('locales') < 0) {
    return Undefined
  }

  let index = 0

  return new Promise((resolve, reject) => {
    async.mapSeries(
      utils.array(doc, !this.array),
      async(value) => {

        const fileResourcePath = this.array ? utils.joinPaths(resourcePath, index) : resourcePath,
              facets = value && utils.array(value.facets).concat(value)
                .filter(v => v.state === consts.media.states.ready)
                .map(({ name, path, ETag, filename, mime, locale }) => ({ name, path, ETag, filename, mime, locale }))

        index = index += 1

        return (await Promise.all(facets.map(async(facet) => {

          const resourceId = uuid.v4(),
                def = {
                  filename: facet.filename,
                  name: facet.name,
                  mime: facet.mime,
                  object: 'facet',
                  locale: facet.locale,
                  resourceId
                },
                facetPath = normalizeAcPathParts(facet.path)

          let pointer

          try {
            const model = await promised(ac.org, 'createObject', facetPath[0])
            pointer = await promised(model, 'aclReadPath', ac.principal, facetPath[1], facetPath.slice(2).join('.'))
          } catch (err) {
            void err
          }

          // add the facet *after* the definition is exported.
          if (pointer) {
            resourceStream.queueFacet(ac, facet, resourceId, fileResourcePath, pointer)
          }

          return def

        }))).filter(v => v).sort((a, b) => naturalCmp(a.name, b.name))

      },
      (err, result) => err ? reject(err) : resolve(this.array ? result : result[0])
    )
  })

}

FileDefinition.prototype.import = async function(ac, value, resourceStream, parentPath, options) {

  // defer media processing updates until after the import has completed, storing each one.
  let interceptor = ac.hook('save').interceptors['after']
  if (!interceptor) {
    interceptor = (function(resourceStream) {
      return function(inline, fn, taskId) {
        if (taskId === 'file-property-trigger-processor') {
          return function(vars) {
            resourceStream.deferMediaTrigger(joinPaths(fn.getObjectName(), fn.getPath()), fn.bind(this, vars))
          }
        }
        return fn
      }
    })(resourceStream)

    // each time a resource is added for processing, connect then.

    ac.hook('save').intercept('after', interceptor)
  }

  const doc = await PropertyDefinition.prototype.import.call(this, ac, value, resourceStream, parentPath, options),
        { array: isArray } = this,
        result = []

  if (doc === Undefined) {
    return Undefined
  }

  for (let facets of toArray((isArray ? doc : [doc]))) {
    const facetsResult = {}
    for (let facet of toArray(facets, true)) {

      facet = facet || {}
      const resource = await resourceStream.cache.getFacet(pathTo(facet, 'resourceId')),
            { Upload } = modules.db.models,
            { uploadId, uploadExists } = resource

      if (uploadExists) {
        const uploadDoc = await promised(Upload, 'aclReadOne', ac.principal, uploadId, { override: true })
        facetsResult[facet.name] = { source: 'facet', path: uploadDoc.dataFile.path }
      }
    }
    result.push(facetsResult)
  }

  return isArray ? result : result[0]

}
