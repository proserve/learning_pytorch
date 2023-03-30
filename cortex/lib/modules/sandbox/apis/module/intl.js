
'use strict'

const { array: toArray } = require('../../../../utils'),
      { pick } = require('underscore')

function getCanonicalLocales(locales) {
  return Intl.getCanonicalLocales(
    toArray(locales, true).map(v => String(v).replace(/_/g, '-'))
  )
}

function createSupportedLocalesOf(Class) {

  return async function(script, message, locales, options) {

    locales = getCanonicalLocales(locales)
    options = pick(options || {}, 'localeMatcher')
    return Class.supportedLocalesOf(locales, options)
  }

}

function createMethods(Class, allowed, methods) {

  return methods.reduce(
    (api, method) =>
      Object.assign(
        api,
        {
          [method]: async function(script, message, params) {
            return new Class(
              getCanonicalLocales(params[0]),
              pick(params[1] || {}, ...allowed)
            )[method](...params.slice(2))
          }
        }
      ),
    {}
  )

}

function createClass(Class, allowed, methods) {

  return {
    statics: {
      supportedLocalesOf: createSupportedLocalesOf(Class)
    },
    methods: createMethods(Class, allowed, methods)
  }

}

module.exports = {

  classes: {

    DateTimeFormat: createClass(
      Intl.DateTimeFormat,
      [
        'dateStyle', 'timeStyle', 'calendar', 'dayPeriod', 'numberingSystem', 'localeMatcher', 'timeZone', 'hourCycle',
        'formatMatcher', 'weekday', 'era', 'year', 'month', 'day', 'hour', 'minute', 'second', 'fractionalSecondDigits',
        'timeZoneName'
      ],
      ['format', 'formatToParts', 'resolvedOptions', 'formatRange', 'formatRangeToParts']
    ),

    NumberFormat: createClass(
      Intl.NumberFormat,
      [
        'compactDisplay', 'currency', 'currencyDisplay', 'currencySign', 'localeMatcher', 'notation', 'numberingSystem',
        'signDisplay', 'style', 'unit', 'unitDisplay', 'useGrouping', 'minimumIntegerDigits', 'minimumFractionDigits',
        'maximumFractionDigits', 'minimumSignificantDigits', 'maximumSignificantDigits'
      ],
      ['format', 'formatToParts', 'resolvedOptions']
    ),

    ListFormat: createClass(
      Intl.ListFormat,
      ['localeMatcher', 'type', 'style'],
      ['format', 'formatToParts']
    ),

    RelativeTimeFormat: createClass(
      Intl.RelativeTimeFormat,
      ['localeMatcher', 'numeric', 'style'],
      ['format', 'formatToParts', 'resolvedOptions']
    ),

    PluralRules: createClass(
      Intl.PluralRules,
      [
        'localeMatcher', 'type', 'minimumIntegerDigits', 'minimumFractionDigits', 'maximumFractionDigits',
        'minimumSignificantDigits', 'maximumSignificantDigits'
      ],
      ['resolvedOptions', 'select']
    ),

    Collator: createClass(
      Intl.Collator,
      ['localeMatcher', 'usage', 'sensitivity', 'ignorePunctuation', 'numeric', 'caseFirst', 'collation'],
      ['compare', 'resolvedOptions']
    )

  },

  statics: {

    getCanonicalLocales: async function(script, message, params) {
      return getCanonicalLocales(params[0])
    }

  }

}
