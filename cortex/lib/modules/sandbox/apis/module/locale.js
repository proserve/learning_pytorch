'use strict'

const { uniq } = require('underscore'),
      { locale } = require('../../../../modules'),
      config = require('cortex-service/lib/config'),
      { array: toArray, isSet } = require('../../../../utils'),
      deprecatedValidLocalesList = uniq(config('locale.valid').split(',').sort())

module.exports = {

  getRequestLocales: async function(script) {
    return locale.getChosenLocales(script.ac)
  },

  matchBestChosenLocale: async function(script, message, availableLocales, wildcardDefault) {
    return locale.matchBestChosenLocale(
      script.ac,
      toArray(availableLocales, isSet(availableLocales)),
      wildcardDefault
    )
  },

  isValid: async function(script, message, value) {
    return locale.isValid(value)
  },

  validLocales: async function() {
    return deprecatedValidLocalesList
  },

  bestMatch: async function(script, message, value) {
    return locale.bestMatch(value)
  },

  caseMatch: async function(script, message, value) {
    return locale.getCaseMatch(value)
  },

  parse: async function(script, message, value) {
    return locale.parse(value).toObject()
  }
}
