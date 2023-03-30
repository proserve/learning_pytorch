const { debounce } = require('underscore'),
      { formatLocaleToCortex } = require('./i18n-utils'),
      modules = require('../../modules'),
      acl = require('../../acl'),
      { promised } = require('../../utils')

class I18nCortexBackend {

  constructor(services, options = {}) {
    this.pending = []
    this.type = 'backend'
    this.init(services, options)
  }
  init(services, options) {
    this.principal = options.principal
    this.interval = options.debounceMs || 50
    this.debounceLoad = debounce(this.load, this.interval)
  }

  read(language, namespace, callback) {

    this.pending.push({
      language: formatLocaleToCortex(language),
      namespace,
      callback
    })
    this.debounceLoad()
  }

  load() {
    if (!this.pending.length) return
    // reset pending
    const loading = this.pending
    this.pending = []

    if (!this.principal) {
      return loading.forEach(item => item.callback(null, null))
    }
    // get all languages and namespaces needed to be loaded
    // eslint-disable-next-line one-var
    const toLoad = loading.reduce((mem, item) => {
      if (mem.languages.indexOf(item.language) < 0) mem.languages.push(item.language)
      if (mem.namespaces.indexOf(item.namespace) < 0) mem.namespaces.push(item.namespace)
      return mem
    }, { languages: [], namespaces: [] })

    promised(modules.db.models.i18nbundle, 'aclList', this.principal, {
      where: { locale: { $in: toLoad.languages }, namespace: { $in: toLoad.namespaces } },
      allowNoLimit: true,
      limit: false,
      skipAcl: true,
      json: true,
      grant: acl.AccessLevels.Read
    }).then((bundle) => {
      loading.forEach(item => {
        const data = bundle?.data?.find(d => d.locale === item.language && d.namespace === item.namespace)
        item.callback(null, data?.data || {}) // if no error and no translations for that lng-ns pair return empty object
      })
    }).catch(e => {
      loading.forEach(item => item.callback(e, null))
    })
  }
}

I18nCortexBackend.type = 'backend'
module.exports = I18nCortexBackend
