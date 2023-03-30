'use strict'

const config = require('cortex-service/lib/config'),
      clone = require('clone'),
      AccessPrincipal = require('../access-principal'),
      { path: pathTo, rString } = require('../utils'),
      IncomingMessage = require('http').IncomingMessage,
      AccessContext = require('../acl').AccessContext,
      { capitalize } = require('inflection'),
      bcp47 = require('../bcp-47'),
      { MemoryCache } = require('cortex-service/lib/memory-cache'),
      langCache = new MemoryCache({
        maxItems: 1000
      })

let Undefined

/*
 * @todo tie acceptLanguage into Translation objects.
 *    1. acceptLanguage = require('accept-language').
 *    2. add accepted languages per app.
 *    3. add tags to apps to tie into translation.
 */
const parsedLocaleStringCache = {}

function parseNormalizedLocaleString(str) {
  if (parsedLocaleStringCache[str]) {
    return parsedLocaleStringCache[str]
  }
  str = typeof str === 'string'
    ? str.trim().replace(/_/g, '-')
    : ''

  let parsed
  const cached = langCache.get(str)

  if (cached) {
    parsed = cached.result
  } else {
    parsed = bcp47.parse(str)

    if (typeof parsed.language === 'string') {
      parsed.language = parsed.language.toLowerCase()
    }

    if (typeof parsed.script === 'string') {
      parsed.script = capitalize(parsed.script.toLowerCase())
    }

    if (typeof parsed.region === 'string') {
      parsed.region = parsed.region.toUpperCase()
    }

    langCache.set(str, { result: parsed })
  }

  parsedLocaleStringCache[str] = clone(parsed)
  return parsedLocaleStringCache[str]
}

class Locale {

  #bcp47

  constructor(str) {
    this.#bcp47 = parseNormalizedLocaleString(str)
  }

  serialize() {
    return bcp47.stringify(this.#bcp47).replace(/-/g, '_')
  }

  toObject() {
    const { language, script, region } = this
    return { language, script, region }
  }

  toString() { return this.serialize() }

  toJSON() { return this.serialize() }

  get language() {
    return this.#bcp47.language || Undefined
  }

  get script() {
    return this.#bcp47.script || Undefined
  }

  get region() {
    return this.#bcp47.region || Undefined
  }

}

Locale['default'] = new Locale(config('locale.defaultLocale') || process.env.LANG || 'en_US')

class Locales {

  constructor(str) {

    this.length = 0
    this.sort = Array.prototype.sort
    this.push = Array.prototype.push
    this._index = null
    if (str) {
      String(str).split(',').forEach(item => {
        const parts = item.split(';'),
              _locale = parts[0],
              q = parts[1],
              locale = new Locale(_locale.trim())
        locale.score = q ? +q.slice(2) || 0 : 1
        this.push(locale)
      })
      this.sort(function(a, b) {
        return a.score < b.score
      })
    }
  }

  get index() {
    if (!this._index) {
      this._index = {}
      for (let _i = 0, _len = this.length; _i < _len; _i++) {
        let locale = this[_i]
        this._index[locale] = locale
        const simple = `${locale.language}_${locale.region}`
        if (locale.script && locale.region && !this._index[simple]) {
          this._index[simple] = locale
        }
      }
    }
    return this._index
  }

  best(locales = null) {
    let index, item, locale
    locale = Locale['default']
    if (!locales) {
      return this[0] || locale
    }
    index = locales.index
    for (let _i = 0, _len = this.length; _i < _len; _i++) {
      item = this[_i]
      if (index[item]) {
        return index[item]
      } else if (index[item.language]) {
        locale = new Locale(item.language)
      }
    }
    return locale
  }

  serialize() {
    return Array.prototype.slice.call(this)
  }
  toJSON() {
    return this.serialize()
  }
  toString() {
    return String(this.toJSON())
  }

}

class LocaleModule {

  parse(str) {
    return new Locale(str)
  }

  discern(arg, { ensure = true, principal } = {}) {

    let ac, req, loc

    if (principal && !(principal instanceof AccessPrincipal)) {
      principal = null
    }

    if (arg instanceof AccessContext) {
      ac = arg
      principal = principal || ac.principal
      if (ac.req instanceof IncomingMessage) {
        req = ac.req
      }
    } else if (arg instanceof IncomingMessage) {
      req = arg
      principal = principal || req.principal
    } else if (arg instanceof AccessPrincipal) {
      principal = principal || arg
    }

    if (ac) {
      loc = ac.getLocale()
    }
    if (!loc && req) {
      loc = this.getChosenRequestLanguages(req)[0]
      if (loc === '*') {
        loc = null
      }
    }
    if (!loc && principal) {
      loc = pathTo(principal.account, 'locale') || principal.org.locale
    }

    if (ensure) {
      try {
        const locales = new Locales(loc)
        loc = locales.best().toString()
      } catch (e) {
        loc = Locale['default'].toString()
      }
    } else if (typeof loc === 'string') {
      loc = new Locale(loc.split(';')[0].trim().split(',')[0].trim()).toString()
    }

    return loc

  }

  getChosenLocales(ac) {

    return this.getChosenRequestLanguages(ac.req)

  }

  getChosenRequestLanguages(req) {

    let chosen = []

    if (req instanceof IncomingMessage) {

      try {

        const headerValue = rString(req.header('accept-language'), '*').trim()

        if (headerValue !== '*') {

          const parsed = this.parseAcceptLanguage(headerValue.replace(/_/g, '-'))

          for (let entry of parsed) {
            const locale = new Locale(entry.tag).serialize()
            if (locale) {
              chosen.push(locale)
            }
          }
        }

      } catch (err) {
        void err
      }

    }

    if (chosen.length === 0) {
      chosen.push('*')
    }

    return chosen

  }

  /**
   *
   * @param ac
   * @param available
   * @param wildcardDefault
   * @returns {*}
   */
  matchBestChosenLocale(ac, available = [], wildcardDefault = null) {

    // detect if the local was explicitly set (eg. via script or driver option)
    let localeMatch = ac.getFixedLocale()

    if (!localeMatch) {

      // choose the best locale based on a best fit from the client (eg. accept-language headers)
      // and what is available.
      const chosen = this.getChosenLocales(ac),
            availableLocales = available.map(locale => {
              const [language] = locale.split('_')
              return { locale, language }
            })

      for (const locale of chosen) {

        if (locale === '*') {
          if (wildcardDefault) {
            return wildcardDefault
          } else {
            return available[0]
          }
        }

        const [language, region] = locale.split('_'),
              exactMatch = availableLocales.find(available => available.locale === locale),
              languageMatch = !region && availableLocales.find(available => available.language === language)

        localeMatch = pathTo(exactMatch || languageMatch, 'locale')

        if (localeMatch) {
          break
        }
      }
    }

    return localeMatch

  }

  isValid(loc) {
    if (loc instanceof Locale) {
      loc = loc.serialize()
    }
    if (Array.isArray(loc)) {
      const mappedLocs = loc.map(l => {
        const str = l instanceof Locale ? l.serialize() : new Locale(l).serialize()
        return !!str && str === l
      })
      return mappedLocs.every(Boolean)
    }
    const str = new Locale(loc).serialize()
    return !!str && str === loc
  }

  bestMatch(loc) {
    try {
      const locales = new Locales(loc)
      return locales.best().toString()
    } catch (e) {
    }
    return null
  }

  getCaseMatch(locale) {

    const input = typeof locale === 'string' ? locale : '',
          valid = this.isValid(input)
    if (input && !valid) {
      const match = this.bestMatch(input)
      if (match && match.toLowerCase() === input.replace(/-/g, '_').toLowerCase()) {
        return match
      }
    }
    return valid ? input : null
  }

  create(str) {
    return new Locale(str)
  }

  /**
   *
   * @param value
   * @returns [{tag, quality}]
   */
  parseAcceptLanguage(value) {

    return rString(value, '')
      .split(',')
      .map(weightedLanguageRange => {
        const components = weightedLanguageRange.replace(/\s+/, '').split(';')
        return {
          tag: components[0],
          quality: components[1] ? parseFloat(components[1].split('=')[1]) : 1.0
        }
      })
      .filter(languageTag => languageTag && languageTag.tag)
      .sort((a, b) => b.quality - a.quality)

  }

}

module.exports = new LocaleModule()
