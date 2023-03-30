const i18Next = require('i18next'),
      { pick, uniq, isEmpty, isArray } = require('underscore'),
      { createHash } = require('crypto'),
      { localize } = require('pseudo-localization'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      modules = require('../index'),
      utils = require('../../utils'),
      acl = require('../../acl'),
      ap = require('../../access-principal'),
      consts = require('../../consts'),
      { mergeDeep, flattenPaths, extractVars, formatCortexToLocale } = require('./i18n-utils'),
      I18nCortexBackend = require('./i18n-cortex-backend'),
      { promised, rNum, path: pathTo, rBool, isSet } = utils,
      BACKOFF_MS = 5,
      MAX_RETRIES = 50,
      wait = async(done) => {
        for (let retry = 1; retry <= MAX_RETRIES; retry++) {
          if (done()) {
            return
          }
          await new Promise(resolve => setTimeout(resolve, BACKOFF_MS * retry))
        }
      }

let Undefined

class i18n {

  constructor() {
    if (!this.i18nInstance) {
      this.i18nInstance = i18Next.createInstance()
    }
    this.loaded = false
    this.loading = false
  }

  reload(locales, namespaces) {
    return Promise.all([
      this.i18nInstance?.loadLanguages(locales),
      this.i18nInstance?.loadNamespaces(namespaces)
    ])
  }

  removeResource(locale, namespace) {
    return this.loaded && this.i18nInstance?.removeResourceBundle(locale, namespace)
  }

  async dir(org, locale) {
    if (!this.loaded) {
      await this.load(org)
    }
    return this.i18nInstance?.dir(formatCortexToLocale(locale))
  }

  async load(org) {

    if (this.loading) {
      await wait(() => !this.loading && this.loaded)
    }

    if (this.loaded || !this.i18nInstance) {
      return
    }

    try {
      this.loading = true
      const existingNsLoc = await modules.db.models.i18nbundle.collection.find({ org: org._id, object: 'i18nbundle', reap: false }).project({ locale: 1, namespace: 1 }).toArray(),
            ns = uniq(existingNsLoc.map(d => d.namespace)),
            locales = uniq(existingNsLoc.map(l => formatCortexToLocale(l.locale)))

      await this.i18nInstance.use(I18nCortexBackend).init({
        debug: rBool(config('i18n.debug'), false),
        ns,
        lng: locales,
        nonExplicitSupportedLngs: true,
        load: 'currentOnly',
        partialBundledLanguages: true,
        fallbackLng: false,
        fallbackNS: 'cortex',
        backend: {
          principal: ap.synthesizeAnonymous(org)
        }
      })
      this.loaded = true
    } catch (err) {
      this.loaded = false
      logger.error(`Could not initialize i18ninstance`, utils.toJSON(err))
    } finally {
      this.loading = false
    }

    org.i18n = this
  }

  async translate(ac, key, options = {}) {
    const { locale, namespace, pseudo } = options,
          loc = formatCortexToLocale(locale || ac.getLocale()),
          { org } = ac.principal

    if (!this.loaded) {
      await this.load(org)
    }

    let keyString = key,
        translated = null
    if (namespace) {
      keyString = `${namespace}:${key}`
    }
    if (loc && this.i18nInstance.resolvedLanguage !== loc) {
      try {
        await this.i18nInstance.changeLanguage(loc)
      } catch (e) {
        logger.error(`Failed to change language ${loc}`, utils.toJSON(e))
      }
    }

    if (this.i18nInstance.exists(keyString)) {
      translated = i18n.pseudoTranslate(org, this.i18nInstance.t(keyString), pseudo)
    }
    return translated
  }

  static pseudoTranslate(org, value, options = {}) {
    const { enabled, mode = 'accented', expand = '0', limited = false } = options,
          pseudoConfig = isSet(enabled) ? options : org.configuration.i18n.pseudoLocalization || {}
    if (pseudoConfig.enabled) {
      if (expand) {
        const num = value.length + Math.ceil((value.length * parseInt(pseudoConfig.expand)) / 100)
        value = value.padEnd(num, '.')
      }
      let result = localize(value, { strategy: mode })
      return limited ? `[${result}]` : result
    }
    return value
  }

  async translateFile(ac, key, options = {}) {
    let asset
    const locale = (options.locale || ac.getLocale()),
          namespace = (options.namespace || 'cortex'),
          bundles = await promised(modules.db.models.i18nbundle, 'aclLoad', ac.principal, {
            throwNotFound: false,
            grant: acl.AccessLevels.System,
            where: {
              namespace,
              locale
            },
            skipAcl: true
          })

    if (bundles && isArray(bundles.data) && !isEmpty(bundles.data) && isArray(bundles.data[0].assets)) {
      asset = bundles.data[0].assets.find(a => a.key === key)
      return asset && { asset: asset.value, bundle: bundles.data[0] }
    }

    return Undefined
  }

  async buildBundles(ac, options = {}) {
    const { namespaces = [], locales = [], onePerNs = true } = options,
          { I18n } = modules.db.models
    let bundleData,
        ETags,
        assets,
        items,
        removeNonLocale = false,
        where = {}

    if ((Array.isArray(namespaces) && namespaces.length > 0) || (Array.isArray(locales) && locales.length > 0)) {
      const ns = (Array.isArray(namespaces) && namespaces.length > 0) ? { namespace: { $in: namespaces } } : {},
            loc = (Array.isArray(locales) && locales.length > 0) ? { locale: { $in: locales } } : {}
      where = { where: { ...ns, ...loc } }
    } else {
      removeNonLocale = true
    }
    items = await promised(I18n, 'aclList', ac.principal, {
      ...where,
      allowNoLimit: true,
      limit: false,
      skipAcl: true,
      json: true,
      grant: acl.AccessLevels.System
    })
    if (removeNonLocale) {
      const existingLocales = uniq((items.data || []).map(i => i.locale))

      // clear previous bundles
      await promised(modules.db.models.i18nbundle.collection, 'updateMany', {
        org: ac.principal.org._id,
        reap: false,
        locale: { $nin: existingLocales }
      }, { $set: { reap: true } })
    }

    [bundleData, ETags, assets] = this.processItems(items.data)

    // eslint-disable-next-line one-var
    const promises = []
    if (onePerNs) {
      const locEntries = Object.keys(bundleData)
      for (const loc of locEntries) {
        // eslint-disable-next-line no-use-before-define
        const item = bundleData[loc],
              namespaces = Object.keys(item)
        for (const ns of namespaces) {
          promises.push(this.createBundleFile(ac, item[ns], {
            ETags,
            assets,
            locale: loc,
            ns,
            multipleNs: true
          }))
        }
      }
    } else {
      const locEntries = Object.keys(bundleData)
      for (const loc of locEntries) {
        const item = bundleData[loc]
        promises.push(this.createBundleFile(ac, item, {
          ETags,
          assets,
          locale: loc,
          ns: Array.isArray(namespaces) && namespaces.length > 0 ? namespaces.join('-') : null,
          multipleNs: false
        }))
      }
    }

    return Promise.all(promises).then((results) => {
      // load
      if (this.loaded) {
        const itemsToReload = results.filter(r => r.action !== 'none'),
              locales = itemsToReload.map(r => r.locale),
              namespaces = itemsToReload.map(r => r.namespace)
        return this.reload(locales, namespaces).then(() => results)
      } else {
        return this.load(ac.principal.org).then(() => results)
      }
    })

  }

  async getMatchingKeys(ac, key) {

    const bundles = await promised(modules.db.models.i18nbundle, 'aclLoad', ac.principal, {
            json: false,
            throwNotFound: false,
            grant: acl.AccessLevels.Read,
            skipAcl: true
          }),
          found = []
    if (bundles && Array.isArray(bundles.data) && bundles.data.length > 0) {
      const paths = {}
      for (const locale of bundles.data) {
        const locKey = locale.namespace !== 'all' ? `${locale.locale}.${locale.namespace}` : locale.locale
        pathTo(paths, locKey, flattenPaths(locale.data))
        // eslint-disable-next-line one-var
        const keys = Object.keys(pathTo(paths, locKey)).filter(k => k.match(key))
        if (Array.isArray(keys) && keys.length > 0) {
          keys.forEach(k => {
            found.push({ path: [locKey, k].join('.'), ...(pick(locale, '_id', 'locale', 'name', 'namespace')) })
          })
        }
      }
    }
    return found
  }

  async createBundleFile(ac, data, options) {
    const model = modules.db.models.i18nbundle,
          { ETags, locale, ns, multipleNs = false, assets } = options,
          createOptions = {
            skipAcl: true,
            mergeDocuments: true,
            bypassCreateAcl: true,
            grant: acl.AccessLevels.System,
            beforeWrite: (ac, payload, callback) => {
              const fileNode = model.schema.node.findNode('bundle')
              ac.option(`$${fileNode.fqpp}.allowBufferSources`, true)
              callback()
            }
          },
          bundleData = data,
          fileName = `${locale}_${ns}`,
          eTagLocale = ETags[locale],
          eTagJSONString = multipleNs ? JSON.stringify(ETags[locale] ? eTagLocale[ns] : '') : JSON.stringify(eTagLocale),
          payload = {
            locale: locale,
            data,
            assets: i18n.mapToFacets(assets, locale, ns),
            namespace: ns,
            hash: createHash('sha256').update(JSON.stringify(data) + eTagJSONString).digest('hex'),
            ...(ac.principal.org.configuration.i18n.createBundleFileS3 ? { bundle: {
              content: {
                source: 'buffer',
                buffer: Buffer.from(JSON.stringify(bundleData)),
                filename: `${fileName}.json`,
                mime: 'application/json'
              }
            } } : { })
          }
    try {
      const existing = await promised(model, 'aclLoad', ac.principal, {
        where: { locale, namespace: ns },
        forceSingle: true,
        json: false,
        throwNotFound: false,
        grant: acl.AccessLevels.Read,
        skipAcl: true
      })
      if (!existing) {
        return promised(model, 'aclCreate', ac.principal, payload, createOptions).then(() => ({ action: 'created', namespace: ns, locale }))
      } else {
        if (existing.hash !== payload.hash) {
          return promised(model, 'aclUpdate', ac.principal, { locale, namespace: ns }, payload, createOptions).then(() => ({ action: 'updated', namespace: ns, locale }))
        }
      }
      return { action: 'none', namespace: ns, locale }
    } catch (ex) {
      logger.error('There was an error building i18n bundles', ex)
      throw ex
    }
  }

  static async findBundle(ac, locale, namespaces = [], options = {}) {
    const { org } = ac.principal,
          { format = 'json', onlyKeys, pseudo = { enabled: false, mode: 'accented', limited: false, expand: 0 } } = options,
          model = modules.db.models.i18nbundle,
          bundles = await promised(model, 'aclLoad', ap.synthesizeAnonymous(org), {
            where: {
              locale: locale || ac.getLocale(),
              ...(Array.isArray(namespaces) && namespaces.length > 0 ? { namespace: { $in: namespaces } } : {})
            },
            throwNotFound: false,
            json: true,
            grant: acl.AccessLevels.Read,
            skipAcl: true
          }),
          data = bundles.data.reduce((acc, item) => {
            return mergeDeep(acc, { [item.namespace]: item.data })
          }, {})

    let result = null,
        entries = flattenPaths(data)

    if (onlyKeys) {
      entries = Object.keys(entries).reduce((acc, item) => {
        pathTo(acc, item, item)
        return acc
      }, {})
    } else if (pseudo.enabled) {
      entries = Object.keys(entries).reduce((acc, item) => {
        let value = entries[item]
        const { enabled, mode, expand, limited } = pseudo
        pathTo(acc, item, i18n.pseudoTranslate(org, value, { enabled, mode, expand, limited }))
        return acc
      }, {})
    }

    switch (format) {
      case 'android':
        result = entries && i18n.formatAndroidResult(entries)
        break
      case 'ios':
        result = `<?xml version="1.0" encoding="utf-8"?><message>Not supported yet</message>`
        break
      default:
        result = Object.keys(entries).reduce((acc, item) => {
          pathTo(acc, item, entries[item])
          return acc
        }, {})
    }
    return result
  }

  static isPluralKey(key) {
    const plurals = ['_zero', '_one', '_two', '_few', '_many', '_other']
    return plurals.some(element => {
      return key.endsWith(element)
    })
  }

  static formatAndroidResult(entries) {
    const plurals = {},
          items = Object.keys(entries).map(k => {
            const plural = this.isPluralKey(k),
                  value = `<![CDATA[${entries[k]}]]>`
            if (plural) {
              const parts = k.split('_'),
                    last = parts.pop(),
                    key = parts.join('_')
              if (!plurals[key]) {
                plurals[key] = []
              }
              plurals[key].push({ quantity: last, value })
            } else {
              return `<string name="${k}">${value}</string>`
            }
          }).filter(i => i),
          itemsPlural = Object.keys(plurals).map(k => {
            return `<plurals name="${k}">${plurals[k].map(p => `<item quantity="${p.quantity}">${p.value}</item>`).join('')}</plurals>`
          })

    return `<?xml version="1.0" encoding="utf-8"?><resources>${items.join('')}${itemsPlural.join('')}</resources>`
  }

  static checkExtends(item, items, data = {}, path = []) {
    const extendedLocale = items.find(i => i.locale === item.extends && i.namespace === item.namespace && i.extensible)
    if (!extendedLocale || path.indexOf(extendedLocale.extends) > -1) {
      // already did the extend
      return data
    }

    if (extendedLocale.extends) {
      path.push(extendedLocale.locale)
      data = i18n.checkExtends(extendedLocale, items, data, path)
    } else {
      data = mergeDeep(extendedLocale.data, data)
    }

    return data
  }

  processItems(items) {

    if (!items || (Array.isArray(items) && items.length < 1)) {
      logger.warn('bundle not found')
    }

    let bundleData = {},
        assets = {}

    const assetsPaths = {},
          ETags = {},
          addedItems = {}

    for (const item of items) {

      let data = item.data,
          itemAssets = []

      // check extensions before processing it.
      if (item.extends) {
        data = i18n.checkExtends(item, items, item.data, [item.locale])
      }

      if (!assets[item.locale]) {
        assets[item.locale] = {}
      }

      if (!assets[item.locale][item.namespace]) {
        assets[item.locale][item.namespace] = []
      }

      const locale = addedItems[item.locale],
            existing = locale ? addedItems[item.namespace] : null
      if (existing) {
        if (rNum(item.weight, 0) > rNum(existing.weight, 0) && existing.overridable) {
          bundleData[item.locale][item.namespace] = data
          pathTo(addedItems, { [item.locale]: { [item.namespace]: item } })
          itemAssets = item.assets
        } else {
          logger.warn(`i18n Object ${existing.name}: ${existing.locale}:${existing.namespace} has bigger weight or is not overridable`)
        }
      } else {
        bundleData = mergeDeep(bundleData, { [item.locale]: { [item.namespace]: data } })
        pathTo(addedItems, { [item.locale]: { [item.namespace]: item } })
        itemAssets = assets[item.locale][item.namespace].concat(item.assets)
      }

      // Only iterate over THIS item assets.
      if (isArray(item.assets) && !isEmpty(item.assets)) {
        // do assets here
        for (const asset of item.assets) {
          // Discard the assets that aren't ready
          const values = asset.value.filter(v => v.state === consts.media.states.ready)

          if (!isEmpty(values)) {
            if (!ETags[item.locale]) {
              ETags[item.locale] = { [item.namespace]: [] }
            }
            if (!ETags[item.locale][item.namespace]) {
              ETags[item.locale][item.namespace] = []
            }

            ETags[item.locale][item.namespace].push(...values.map(v => v.ETag))
            pathTo(assetsPaths, `${item.locale}.${item.namespace}.${asset.key}`, values.map(v => v.url))
          }
        }
      }

      // Assign assets
      if (isArray(itemAssets) && !isEmpty(itemAssets)) {
        assets[item.locale][item.namespace] = itemAssets
      }
    }
    return [mergeDeep(bundleData, assetsPaths), ETags, assets]
  }

  static mapToFacets(assets, locale, ns) {
    let result = []

    if (assets[locale] && assets[locale][ns]) {
      result = assets[locale][ns].map(a => {
        return {
          key: a.key,
          value: a.value.filter(v => v.state === consts.media.states.ready).map(v => {
            return {
              content: `facet://${v.path}`
            }
          })
        }
      }).filter(a => isArray(a.value) && !isEmpty(a.value))
    }

    return result
  }

  static async integrityReport(principal, baseLocale, subSetLocales = []) {
    const report = {
            numLocales: 0,
            wrongPlaceholders: {},
            missingKeys: {}
          },
          baseBundles = await promised(modules.db.models.i18nbundle, 'aclLoad', principal, {
            where: {
              locale: baseLocale
            },
            throwNotFound: false,
            json: true,
            grant: acl.AccessLevels.Read,
            skipAcl: true
          }),
          where = Array.isArray(subSetLocales) && subSetLocales.length ? { where: { locale: { $in: subSetLocales } } } : {},
          bundles = await promised(modules.db.models.i18nbundle, 'aclLoad', principal, {
            ...where,
            throwNotFound: false,
            json: true,
            grant: acl.AccessLevels.Read,
            skipAcl: true
          }),
          baseData = baseBundles.data?.reduce((acc, item) => {
            return mergeDeep(acc, { [item.namespace]: item.data })
          }, {}),
          bundlesData = bundles.data?.filter(b => b.locale !== baseLocale).reduce((acc, item) => {
            if (acc[item.locale]) {
              acc[item.locale] = mergeDeep(acc[item.locale], { [item.namespace]: item.data })
            } else {
              acc[item.locale] = { [item.namespace]: item.data }
            }
            return acc
          }, {}),
          baseFlattenData = baseData && flattenPaths(baseData),
          placeHolders = Object.keys(baseFlattenData).reduce((acc, item) => {
            const v = extractVars(baseFlattenData[item])
            if (v.length) {
              acc[item] = v
            }
            return acc
          }, {})

    report.numLocales = Object.keys(bundlesData).length + 1

    for (const loc of Object.keys(bundlesData)) {
      const item = bundlesData[loc],
            flattenData = flattenPaths(item),
            diffKeys = Object.keys(baseFlattenData).filter((i) => Object.keys(flattenData).indexOf(i) < 0),
            vars = Object.keys(flattenData).reduce((acc, item) => {
              const v = extractVars(flattenData[item])
              if (v.length) {
                acc[item] = v
              }
              return acc
            }, {})
      if (diffKeys.length) {
        report.missingKeys[loc] = diffKeys
      }
      const baseHasPlaceHolders = !!Object.keys(placeHolders).length,
            hasPlaceHolders = !!Object.keys(vars).length
      if (baseHasPlaceHolders && hasPlaceHolders) {
        const diffs = Object.keys(vars).filter((i) => vars[i] !== placeHolders[i]).map((item) => {
          if (placeHolders[item] && vars[item]) {
            return { [item]: placeHolders[item].filter(x => !vars[item].includes(x)).concat(vars[item].filter(x => !placeHolders[item].includes(x))) }
          }
          return null
        }).reduce((acc, item) => {
          if (!item) {
            return acc
          }
          const value = Object.values(item)[0],
                hasValue = Array.isArray(value) && value.length
          if (hasValue) {
            acc[Object.keys(item)[0]] = value
          }
          return acc
        }, {})

        if (Object.keys(diffs).length) {
          report.wrongPlaceholders[loc] = diffs
        }
      } else if (baseHasPlaceHolders && !hasPlaceHolders) {
        report.wrongPlaceholders[loc] = '[Missing all placeholders]'
      } else if (!baseHasPlaceHolders && hasPlaceHolders) {
        report.wrongPlaceholders[loc] = '[Extra placeholders added]'
      }
    }

    return report
  }

  static dir(locale) {
    return i18Next.dir(locale)
  }

}

module.exports = i18n
