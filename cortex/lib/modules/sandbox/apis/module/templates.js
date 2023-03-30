'use strict'

const { rBool, isSet } = require('../../../../utils'),
      _ = require('underscore'),
      modules = require('../../../../modules')

module.exports = {

  version: '1.0.0',

  load: function(script, message, type, name, options, callback) {

    options = _.pick(options || {}, 'version', 'locale', 'fallback', 'latest', 'spec', 'versions')

    const { ac, locale } = script,
          { principal } = ac,
          { version, fallback, latest, spec, versions } = options

    modules.db.models.template.loadTemplate(
      principal,
      options.locale || locale,
      type,
      name,
      {
        version,
        fallback,
        latest: !isSet(latest) ? !isSet(version) : rBool(latest),
        spec,
        versions
      },
      (err, result) => {
        callback(err, result)
      })

  },

  render: function(script, message, type, name, variables, options, callback) {

    options = _.pick(options || {}, 'locale')

    const { ac, locale } = script,
          { principal } = ac

    modules.db.models.template.renderTemplate(
      principal,
      options.locale || locale,
      type,
      name,
      variables,
      (err, result) => {
        callback(err, result && result.output)
      })

  }

}
