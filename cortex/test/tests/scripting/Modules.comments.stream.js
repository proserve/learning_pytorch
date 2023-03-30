'use strict'

const server = require('../../lib/server'),
      wrapper = require('../../lib/wrapped_sandbox')

server.usingMedia = true

module.exports = {

  main: function() {

    // noinspection NpmUsedModulesInstalled
    const posts = require('posts'),
          comments = require('comments'),
          should = require('should'),
          consts = require('consts'),
          http = require('http'),
          // list with comments.
          list = posts.list({ include: 'comments' }),
          // attempt to stream
          item = list.data.filter(function(d) {
            return d &&
                d.comments &&
                d.comments.data &&
                d.comments.data[0] &&
                d.comments.data[0].body &&
                d.comments.data[0].body[0] &&
                d.comments.data[0].body[0].c_file &&
                d.comments.data[0].body[0].c_file.state === consts.media.states.ready
          })[0],
          // attempt to stream
          pointer = comments.read(item.comments.data[0]._id + '/body/0/c_file/content')

    should.exist(item, 'there should a be a post with a comment that has a file ready')
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
