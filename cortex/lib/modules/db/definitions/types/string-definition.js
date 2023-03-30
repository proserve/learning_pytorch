'use strict'

const util = require('util'),
      async = require('async'),
      { uniq } = require('underscore'),
      properties = require('../properties'),
      PropertyDefinition = require('../property-definition'),
      { rBool, path: pathTo, array: toArray, getClientIp, rString, findIdInArray, equalIds, isSet } = require('../../../../utils'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules'),
      { expressions: { TypeFactory } } = modules,
      { DeferredRead } = require('../classes/deferred-read'),
      TypeString = TypeFactory.create('String'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config')

let Undefined

class DeferredTranslatedString extends DeferredRead {

  async read() {
    const { parent, key, input } = this,
          { key: translateKey, locale } = input,
          translated = await this.ac.org.i18n.translate(this.ac, translateKey, { locale })
    pathTo(parent, key, translated)
  }

}

function StringDefinition(options) {

  options = options || {}

  PropertyDefinition.call(this, options)

  this.trim = rBool(options.trim, false)
  this.lowercase = rBool(options.lowercase, false)
  this.uppercase = rBool(options.uppercase, false)

  if (this.trim) {
    this.set.push((v, self) => {
      v = toArray(v, true).map(v => {
        if (typeof v !== 'string') v = self.cast(v)
        if (v) return v.trim()
        return v
      })
      return this.array ? v : v[0]
    })
  }
  if (this.lowercase) {
    this.set.push((v, self) => {
      v = toArray(v, true).map(v => {
        if (typeof v !== 'string') v = self.cast(v)
        if (v) return v.toLowerCase()
        return v
      })
      return this.array ? v : v[0]
    })
  }
  if (this.uppercase) {
    this.set.push((v, self) => {
      v = toArray(v, true).map(v => {
        if (typeof v !== 'string') v = self.cast(v)
        if (v) return v.toUpperCase()
        return v
      })
      return this.array ? v : v[0]
    })
  }

  // ------------------------------------------------------

  const localization = options.localization || {}
  this.localization = {
    enabled: rBool(localization.enabled, false),
    aclOverride: rBool(localization.aclOverride, false),
    acl: (localization.acl === acl.Inherit) ? acl.Inherit : acl.mergeAndSanitizeEntries(localization.acl),
    strict: rBool(localization.strict, false),
    fallback: rBool(localization.fallback, true),
    valid: toArray(localization.valid),
    fixed: rString(localization.fixed, ''),
    translationKey: rString(localization.translationKey, ''),
    namespace: rString(localization.namespace, '')
  }

}
util.inherits(StringDefinition, PropertyDefinition)

StringDefinition.typeName = 'String'

StringDefinition.mongooseType = 'String'

StringDefinition.defaultValues = {
  'req.ip': function(ac) {
    return getClientIp(ac.req) || undefined
  },
  'req.ipv4': function(ac) {
    return getClientIp(ac.req) || undefined
  },
  'req.client.key': function(ac) {
    return pathTo(ac, 'req.orgClient.key')
  },
  'req.client.name': function(ac) {
    return pathTo(ac, 'req.orgApp.name')
  },
  'req.headers.user-agent': function(ac) {
    return ac.req && ac.req.headers && ac.req.header('user-agent')
  }
}
StringDefinition.staticDefaultValues = true

StringDefinition.prototype.getTypeName = function() {
  return StringDefinition.typeName
}

StringDefinition.prototype.initNode = function(root, parent, initializingASetDocument, isSetProperty) {

  // already initialized
  if (this.parent) {
    return
  }

  PropertyDefinition.prototype.initNode.call(this, root, parent, initializingASetDocument, isSetProperty)
  // localized properties are only allowed at the top level or a level down and never in a set.
  // also, the parent must have an unique key if it's an array.
  const localized = this.localization.enabled &&
      (
        root.objectName === 'object' ||
          (
            !isSetProperty &&
              !initializingASetDocument &&
              (
                root === parent ||
                  (root === parent.parent && (parent.uniqueKey || !parent.array))
              )
          )
      ),
        host = this,
        notAllowedPaths = ['feedDefinition']

  if (localized && notAllowedPaths.filter(p => parent.fullpath.indexOf(p) > -1).length === 0) {
    host.localized = true
    if (this.reader || this.writer || this.pusher || this.groupReader) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'String property cannot be localized and have custom readers or writers', path: this.fqpp })
    }

    this.readerSearchOverride = true

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

      let { array, name, label, uniqueKey } = parent,
          property = null

      inDocumentArray = array

      isSetProperty = isSetProperty || (parent.pathParent && parent.pathParent.getTypeName() === 'Set')

      if (isSetProperty) {
        array = true
        inDocumentArray = true
        property = localeParent.findNode(host.pathParent.fullpath)
        if (!property) {
          const parentNode = host.pathParent.parent && host.pathParent.parent.fullpath ? localeParent.findNode(host.pathParent.parent.fullpath) : null
          if (parentNode) {
            localeParent = parentNode
          }
        }
        name = host.pathParent.name
        label = host.pathParent.label
        uniqueKey = host.pathParent.uniqueKey
        parent = host.pathParent
      } else {
        property = localeParent.findNode(parent.name)
      }

      localeParent = property || localeParent.addProperty({
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

        if (!property) {
          // add only one time the listeners to parent property
          const _onRemovingValue = parent._onRemovingValue,
                _onValueAdded = parent._onValueAdded

          parent._onRemovingValue = function(ac, node, value, index) {

            let localizedArray = pathTo(ac.subject, localeParent.docpath),
                localizedDoc = findIdInArray(localizedArray, '_id', value._id)

            if (localizedDoc) {
              localeParent._doRemoveDocument(ac, ac.subject, value._id)
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
        }

        if (uniqueKey) {
          let uniqueNode = parent.findNode(uniqueKey)
          if (!uniqueNode) {
            throw Fault.create('cortex.notFound.propertyNode', { reason: 'Unique key node not found.', path: parent.fqpp })
          }
          // on update of unique key update locales unique key as well.
          const _onUniqueNodeValueAdded = uniqueNode._onValueAdded
          uniqueNode._onValueAdded = function(ac, node, value, previous, index) {
            if (isSet(this)) {
              findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray, true)
            }
            if (_onUniqueNodeValueAdded) {
              _onUniqueNodeValueAdded(ac, node, value, previous, index)
            }

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
            name, label, history, validators, auditable, readable, removable, writable,
            array, uniqueValues, canPush, canPull, writeOnCreate, readAccess, writeAccess
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
              type: 'String',
              acl: [acl.AccessLevels.Read, acl.AccessLevels.Update],
              scoped: false,
              writable,
              array,
              uniqueValues,
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

                // We are directly writing to locales, so locale value of payload will be used
                ac.option('$payloadLocale', this.locale)
                return value
              }

            }]
          }),
          localizedValueNode = localizedProperty.findNode('value'),
          localizedLocaleNode = localizedProperty.findNode('locale')

    if (isSetProperty) {
      // set path for locale/value in set property
      localizedValueNode.docpath = localizedValueNode.name
      localizedLocaleNode.docpath = localizedLocaleNode.name
      localizedProperty.addDependency(`locales.${host.pathParent.fullpath}.${host.pathParent.uniqueKey}`)
    }

    host.localizedProperty = localizedProperty
    localizedProperty.localizedHost = host
    localizedProperty.addDependency(host.fullpath)

    // get values form all localizations. when matching, use indexes and swap actual match value with parser magic.
    host.getIndexableValue = function(rootDocument, parentDocument, node, value) {
      let values = toArray(value, true).slice()
      if (!isLocalizedObject(rootDocument)) {
        return values
      }
      values = {}
      this.root.walkDocument(rootDocument, (parentDocument, node, value) => {
        // found node. collect and stop
        if (node === localizedValueNode && value !== Undefined) {
          if (!values[parentDocument.locale]) {
            values[parentDocument.locale] = []
          }
          values[parentDocument.locale] = values[parentDocument.locale].concat(toArray(value, true))
          return -2 // return -1 at the end of the parent array.
        }
      })
      return values
    }

    host.export = async function(ac, val, resourceStream, parentPath, options) {
      const resourcePath = this.getExportResourcePath(parentPath, options)
      return this.isExportable(ac, val, resourceStream, resourcePath, parentPath, options)
        ? val
        : undefined
    }

    host.checkRequired = function(ac, node, type, value) {
      if (!isLocalizedObject(ac.subject) || isUsingBundles(ac.subject)) {
        return type.checkRequired(value, this)
      }

      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            localizedDoc = pathTo(parentDocument, localizedProperty.docpath),
            finalLocale = host.localization.fixed || ac.getLocale(true, false)

      if (!localizedDoc || localizedDoc.length === 0 || !finalLocale) {
        return false
      }

      let item = localizedDoc.find(v => v.locale === finalLocale || v.locale === ac.option('$payloadLocale'))

      // required localized strings need a value in the current locale.
      return rString(pathTo(item, 'value'), '').length > 0

    }

    // proxy validation value
    host.getValidationValue = function(ac, node) {
      if (!isLocalizedObject(ac.subject) || isUsingBundles(ac.subject)) {
        return pathTo(this, node.docpath)
      }

      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            localizedDoc = pathTo(parentDocument, localizedProperty.docpath),
            finalLocale = host.localization.fixed || ac.getLocale(true, false)

      if (!localizedDoc || localizedDoc.length === 0 || !finalLocale) {
        return Undefined
      }

      return pathTo(localizedDoc.find(v => v.locale === finalLocale || v.locale === ac.option('$payloadLocale')), 'value')

    }

    host.reader = function(ac, node, selection) {
      // TODO: add searching from bundles if they exists.
      if (!isLocalizedObject(ac.subject)) {
        return pathTo(this, node.docpath)
      }
      // Has bundle translation?
      if (isUsingBundles(ac.subject)) {
        //
        return getTranslatedValue.call(this, node, ac, selection)
      }
      // continue old behavior
      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            localizedDoc = pathTo(parentDocument, localizedProperty.docpath || localizedProperty.name),
            fallbackLocale = ac.getLocale(),
            orgDefaultLocale = ac.org.locale,
            strict = node.localization.strict,
            fallback = node.localization.fallback

      if (!localizedDoc || localizedDoc.length === 0) {
        if (fallback) {
          return pathTo(this, node.docpath)
        }
        return Undefined
      }

      let chosenLocale,
          finalLocale,
          item

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

      return pathTo(item, 'value')

    }

    // re-init the reader so it sticks because this is late-bound
    host.initReader()

    this.writer = function(ac, node, value, options, callback) {
      if (!isLocalizedObject(ac.subject) || isUsingBundles(ac.subject)) {
        return callback(null, value)
      }
      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray, (options.op === 'push' || options.mergeDocuments || inDocumentArray)),
            finalLocale = node.localization.fixed || ac.getLocale(true, false),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            defaultLocale = config('locale.defaultLocale') || process.env.LANG || 'en_US',
            existsDefault = inDocumentArray ? pathTo(parentDocument, localizedProperty.name) : (pathTo(parentDocument, localizedProperty.fullpath) || []).filter(d => d.locale === defaultLocale),
            writeValue = (data, cb) => {
              localizedProperty.aclWrite(copyAc(ac, localizedProperty.writeAccess), parentDocument, data, { ...options, mergeDocuments: true }, err => {
                cb(err)
              })
            },
            done = (err) => {
              if (err) {
                return callback(err)
              }
              if (isSetProperty) {
                return callback(null, value)
              }
              callback()
            }

      if (!finalLocale) {
        return callback(Fault.validationError('cortex.invalidArgument.locale', { resource: ac.getResource(), reason: 'Invalid or missing locale.', path: node.path }))
      }

      if (!parentDocument) {
        return callback(Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: node.fqpp }))
      }

      // @hack. copy hooks so changes triggered from a script are caught.
      // access context should be elegantly copyable at any point.
      function copyAc(origAc, grant) {
        const comment = origAc.comment,
              ac = origAc.copy(comment ? origAc.post : origAc.subject, {}, true)
        if (comment) {
          ac.comment = comment
        }
        ac.setLocale(finalLocale)
        ac.grant = Math.min(acl.fixAllowLevel(grant, true), acl.AccessLevels.Delete)
        ac.$__hooks = pathTo(origAc.$__parentAc, 'apiHooks') || origAc.apiHooks
        ac.$__idx_rebuilds = pathTo(origAc.$__parentAc, 'indexRebuilds') || origAc.indexRebuilds
        return ac
      }

      if (root.objectName !== 'object') {
        // remove original old property path if exists
        pathTo(this, node.docpath, undefined)
      }

      localizedProperty.docpath = localizedProperty.docpath || localizedProperty.localizedHost.docpath || localizedProperty.localizedHost.name
      localizedProperty.fqpparts = localizedProperty.fqpparts || localizedProperty.localizedHost.fqpparts
      localizedProperty.path = localizedProperty.path || localizedProperty.localizedHost.path

      if (existsDefault.length === 0 && defaultLocale !== finalLocale) {
        const val = !Array.isArray(pathTo(parentDocument, node.docpath)) ? pathTo(parentDocument, node.docpath) : value
        async.series([
          (cb) => writeValue([{ locale: defaultLocale, value: val || value }], cb),
          (cb) => writeValue([{ locale: finalLocale, value }], cb)
        ], (err) => {
          done(err)
        })
      } else {
        writeValue([{ locale: finalLocale, value }], done)
      }

    }

    this.remover = function(ac, node, options, callback) {
      if (!isLocalizedObject(ac.subject) || isUsingBundles(ac.subject)) {
        return callback(null, true)
      }
      const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray),
            parentDocument = inDocumentArray ? localizedParent : ac.subject,
            localizedDoc = pathTo(parentDocument, localizedProperty.docpath),
            finalLocale = node.localization.fixed || ac.getLocale(true, false),
            localizedValue = localizedDoc && localizedDoc.find(v => v.locale === finalLocale)

      if (!localizedValue) {
        return callback(null, true)
      }

      localizedProperty._pullDocument(
        ac,
        inDocumentArray
          ? localizedParent
          : ac.subject,
        localizedValue._id,
        (err) => callback(err, true)
      )

    }

    if (array) {

      this.pusher = function(ac, node, value, options, callback) {
        host.writer.call(this, ac, node, value, options, callback)
      }

      this.puller = function(ac, node, value, options, callback) {
        if (!isLocalizedObject(ac.subject) || isUsingBundles(ac.subject)) {
          return callback(null, value)
        }

        const localizedParent = findLocalizedParentDocument(ac, node, localeParent, this, inDocumentArray),
              parentDocument = inDocumentArray ? localizedParent : ac.subject,
              localizedDoc = pathTo(parentDocument, localizedProperty.docpath),
              finalLocale = node.localization.fixed || ac.getLocale(true, false),
              localizedValue = localizedDoc && localizedDoc.find(v => v.locale === finalLocale)

        if (!localizedValue) {
          return callback()
        }

        localizedProperty.findNode('value')._removeElement(
          ac,
          localizedValue,
          value,
          (err) => callback(err)
        )
      }

    }

  }

  function isLocalizedObject(subject) {
    return subject.object === 'object' ? subject.localized : host.localization.enabled
  }

  function isUsingBundles(subject) {
    return !!(subject.useBundles || subject.$model?.useBundles)
  }

  function findLocalesArray(locales, path, doc, create) {
    let result
    // iterate over locales to find the property array that contains it.
    const parts = Array.isArray(path) ? path : path.indexOf('.') ? path.split('.') : [path]
    for (const part of parts) {
      if (result) {
        break
      }
      if (create) {
        // get for writing
        if (locales[part] && parts.length === 1) {
          result = locales[part]
        } else if (locales[part]) {
          if (Array.isArray(locales[part])) {
            let lastParent,
                parents = [],
                currentDoc = doc
            while (!lastParent) {
              const parentDoc = modules.db.getParentDocument(currentDoc)
              if (!parentDoc) {
                lastParent = parents[parents.length - 1]
              } else {
                parents.push(parentDoc._id.toString())
                currentDoc = parentDoc
              }
            }
            const found = locales[part].find(l => parents.indexOf(l._id.toString()) > -1)
            if (found && parts.length === 1) {
              result = found.parentArray ? found.parentArray() : locales[part]
            } else if (found) {
              result = findLocalesArray(found, parts.slice(1), doc, create)
            }
          } else {
            result = findLocalesArray(locales[part], parts.slice(1), doc, create)
          }
        } else {
          // create section if not present.
          pathTo(locales, part, [])
          result = pathTo(locales, part)
        }
        if (result) {
          break
        }
      } else {
        // get for reading
        const properties = locales ? Array.isArray(locales) ? locales : locales[part] : []
        if (!Array.isArray(properties)) {
          const path = parts.slice(1).join('.')
          result = findLocalesArray(properties, path, doc, create)
          // break the loop since we cannot continue further, there is no data next
          break
        } else {
          for (const prop of properties) {
            if (equalIds(prop._id, doc._id)) {
              result = properties
            } else {
              let objProp = prop.toObject ? prop.toObject() : prop
              for (const key of Object.keys(objProp)) {
                if (Array.isArray(objProp[key])) {
                  result = findLocalesArray(objProp[key], [key], doc, create)
                  if (result) {
                    break
                  }
                }
              }
            }
            if (result) {
              break
            }
          }
        }
      }
    }

    return result
  }

  function findLocalizedParentDocument(ac, node, localeParent, parentDocument, inDocumentArray, create = false) {

    let localizedDoc

    if (inDocumentArray) {
      let localizedArray
      if (isSetProperty) {
        localizedArray = ac.subject.locales && findLocalesArray(ac.subject, localeParent.fullpath || node.fullpath, parentDocument, (create || parentDocument.isNew))
      } else {
        localizedArray = pathTo(ac.subject, localeParent.docpath)
        if (!Array.isArray(localizedArray) && create) {
          pathTo(ac.subject, localeParent.docpath, [])
          localizedArray = pathTo(ac.subject, localeParent.docpath)
        }
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
          // add unique key if being created.
          if (localizedDoc && (create || parentDocument.isNew) && uniqueKeyNode && castUniqueKey) {
            localizedDoc[uniqueKeyNode.name] = castUniqueKey
          }
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

  function getTranslatedValue(node, ac, selection) {
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
    const isObjectDef = ac.subject.object === 'object',
          ns = node.localization.namespace ? `${node.localization.namespace}:` : isObjectDef ? 'cortex:' : '' // use cortex as default ns
    // eslint-disable-next-line one-var
    const pathProperty = uniq(['object', ac.subject.name, node.pathParent.name, this.name, node.docpath])
    // eslint-disable-next-line one-var
    let key = isObjectDef ? pathProperty.join('.') : node.localization.translationKey,
        uniqueKey = null

    if (!key) {
      logger.warn(`${node.docpath}: translationKey not defined`)
    }

    if (ac.subject.object !== 'object' && node.pathParent.uniqueKey) {
      // instance object
      const uniqueKeyNode = node.pathParent.findNode(node.pathParent.uniqueKey)

      if (uniqueKeyNode) {
        if (uniqueKeyNode.getTypeName() === 'UUID') {
          uniqueKey = uniqueKeyNode.stringify(uniqueKeyNode.castToBuffer(pathTo(this, node.pathParent.uniqueKey))).toLowerCase()
        }
      }
      if (!uniqueKey) {
        uniqueKey = pathTo(this, node.pathParent.uniqueKey)
      }
    }
    key = `${ns}${[uniqueKey, key].filter(e => !!e).join('.')}`
    return new DeferredTranslatedString(node, ac, { key, locale: chosenLocale }, selection, null)
  }
}

StringDefinition.prototype.castForQuery = function(ac, value) {

  return TypeString.cast(value, { ac, path: this.fullpath, allowRegExp: true })

}

StringDefinition.getProperties = function(depth, props) {

  props
    .find(p => p.name === 'defaultValue')
    .documents
    .find(p => p.name === 'static')
    .properties
    .find(p => p.name === 'value')
    .validators = [{
      name: 'string',
      definition: {
        min: 0,
        max: 100,
        allowNull: true
      }
    }]

  props
    .find(p => p.name === 'unique')
    .validators.push({
      name: 'adhoc',
      definition: {
        message: 'Localized properties cannot be made unique.',
        validator: function(ac, node, unique) {
          return !(this.localization.enabled && unique)
        }
      }
    })

  return [
    {
      label: 'Trim',
      name: 'trim',
      type: 'Boolean',
      // description: 'Trims the input string prior to validation but after writers.',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Lowercase',
      name: 'lowercase',
      type: 'Boolean',
      // description: 'Lowercase the input string prior to validation but after writers.',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Uppercase',
      name: 'uppercase',
      type: 'Boolean',
      // description: 'Uppercase the input string prior to validation but after writers.',
      readable: true,
      writable: true,
      default: false
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

module.exports = StringDefinition
