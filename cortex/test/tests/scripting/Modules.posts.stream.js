'use strict'

const server = require('../../lib/server'),

      wrapper = require('../../lib/wrapped_sandbox')

server.usingMedia = true

module.exports = {

  main: function() {

    /* global consts */

    // noinspection NpmUsedModulesInstalled
    const posts = require('posts'),
          should = require('should'),
          http = require('http')

    let list, item, pointer

    // list
    list = posts.list()

    // attempt to stream
    item = list.data.filter(function(d) {
      // noinspection ES6ModulesDependencies,NodeModulesDependencies
      return d && d.body[0] && d.body[0].c_file && d.body[0].c_file.state === consts.media.states.ready
    })[0]
    should.exist(item, 'there should a be stream-able file ready')

    pointer = posts.read(item._id + '/body/0/c_file/content')
    should.exist(pointer)
    should.exist(pointer.url)

    should.equal(http.get(pointer.url).body, 'Testy')

    return true
  },

  before: function(ac, model, callback) {

    let err
    require('../../lib/create.postable')(ac)
      .catch(e => {
        err = e
      })
      .then(result => {
        callback(err, result)
      })

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
