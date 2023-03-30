const { pick } = require('underscore'),
      modules = require('../../../../modules'),
      Fault = require('cortex-service/lib/fault')

module.exports = {
  async translate(script, message, key, options) {
    return script.ac.principal.org.i18n.translate(script.ac, key, options || {})
  },
  async report(script, message, locale, subSetLocales) {
    const loc = locale || script.ac.getLocale()
    return modules.i18n.integrityReport(script.ac.principal, loc, subSetLocales)
  },
  async trace(script, message, key) {
    // find the keys and trace them.
    return script.ac.principal.org.i18n.getMatchingKeys(script.ac, key)
  },
  async getBundle(script, message, locale, namespaces, options) {
    return modules.i18n.findBundle(script.ac, locale, namespaces, options || {})
  },
  async buildBundles(script, message, options) {
    if (!script.ac.principal.isOrgAdmin()) {
      throw Fault.create('cortex.accessDenied.principal', { reason: 'You must be an admin to build bundles.' })
    }
    const args = pick(options, 'namespaces', 'locales', 'name', 'onePerNs'),
          i18n = script.ac.principal.org.i18n || new modules.i18n()
    return i18n.buildBundles(script.ac, args)
  }
}
