'use strict'

const server = require('../../lib/server')

server.usingMedia = true

module.exports = {

  main: function() {

    var name = 'c_script_mod_obj_stream_tests',
        objects = require('objects'),
        should = require('should'),
        consts = require('consts'),
        http = require('http'),
        list = objects.list(name, { paths: ['c_file'] }),
        item = list.data.filter(function(d) { return d && d.c_file && d.c_file.state === consts.media.states.ready })[0],
        pointer = objects.read(name, item._id + '/c_file/content')

    should.exist(item, 'there should a be stream-able file ready')
    should.exist(pointer)
    should.exist(pointer.url)
    should.equal(http.get(pointer.url).body, 'Testy')

    return true
  },

  before: function(ac, model, callback) {
    require('../../lib/create.streamable')(ac, callback)
  }
}

describe('Scripting', function() {
  it(...(require('../../lib/wrapped_sandbox').wrap(__filename, module.exports)))
})
