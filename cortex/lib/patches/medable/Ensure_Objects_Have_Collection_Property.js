'use strict'

module.exports = function(callback) {

  const modules = require('../../modules')

  modules.db.models.Object.collection.updateMany(
    {
      dataset: {
        $exists: false
      }
    },
    {
      $set: {
        dataset: {
          collection: 'contexts'
        }
      }
    },
    callback
  )

}
