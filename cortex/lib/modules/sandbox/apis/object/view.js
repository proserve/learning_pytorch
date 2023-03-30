
'use strict'

const _ = require('underscore'),
      modules = require('../../../../modules'),
      utils = require('../../../../utils')

module.exports = {

  static: {

    run: function(script, message, viewCodeOrId, options, callback) {

      exec(script, message, viewCodeOrId, options, false, callback)

    },

    passthru: function(script, message, viewCodeOrId, options, callback) {

      exec(script, message, viewCodeOrId, options, true, callback)

    }

  }
}

function exec(script, message, viewCodeOrId, options, returnCursor, callback) {

  options = utils.extend(script.allowedOptions(options, 'paths', 'limit', 'skip', 'where', 'map', 'group', 'sort', 'pipeline', 'locale'), {
    req: script.ac.req,
    script
  });

  ['where', 'map', 'group', 'sort', 'pipeline'].forEach(function(key) {
    if (options[key] !== null && options[key] !== undefined) {
      try {
        options[key] = JSON.stringify(options[key])
      } catch (err) {
      }
    }
  })

  options.returnCursor = returnCursor

  if (utils.couldBeId(viewCodeOrId) || (_.isString(viewCodeOrId) && (viewCodeOrId.indexOf('c_') === 0 || ~viewCodeOrId.indexOf('__')))) {
    modules.db.models.view.viewRun(script.ac.principal, viewCodeOrId, options, function(err, docs) {
      callback(err, docs)
    })
    return
  }

  modules.views.runView(script.ac.principal, viewCodeOrId, options, function(err, docs) {
    callback(err, docs)
  })

}
