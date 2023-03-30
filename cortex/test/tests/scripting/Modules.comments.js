'use strict'

/* global consts, ObjectID */

const server = require('../../lib/server'),
      wrapper = require('../../lib/wrapped_sandbox')

server.usingMedia = true

module.exports = {

  main: function() {

    const pluralName = 'c_postables',
          objects = require('objects'),
          posts = require('posts'),
          comments = require('comments'),
          should = require('should'),
          connections = require('connections')

    let context, post, instance, result, date, list

    context = objects.create(pluralName, { c_string: 'a' })
    context.c_string.should.equal('a')

    // create post
    post = posts.create('c_postables', context._id, 'c_post_type_a', {
      body: [{ name: 'c_segment_a', c_number: 42 }],
      targets: [{ target: consts.mocha.principals.provider._id, type: 1 }]
    }, { grant: consts.accessLevels.delete })

    // create comment
    instance = comments.create(post._id, { body: [{ name: 'c_comment_segment_a', c_number: 42 }] }, { grant: consts.accessLevels.delete })

    // read path
    result = comments.read([instance._id, 'body', instance.body[0]._id, 'c_number'].join('.'))
    should.equal(result, 42);

    // update pointer content path
    (function() {
      try {
        comments.update([instance._id, 'body', instance.body[0]._id, 'c_file'].join('.'), { content: 'text.txt' })
        instance = comments.read([instance._id, 'body', instance.body[0]._id, 'c_file', 'content'].join('.'))
      } catch (err) {
        if (err.errCode === 'cortex.accepted.mediaNotReady') {
          return
        }
        throw err
      }
      throw new Error('update pointer content path should cause a cortex.accepted.mediaNotReady error.')
    }())

    // update post
    comments.update(instance._id, { body: [{ _id: instance.body[0]._id, c_string: '42' }] }, { grant: consts.accessLevels.delete })
    instance = comments.read(instance._id)
    instance.body[0].c_string.should.equal('42')

    // update path
    date = new Date(Date.now() - 86400000)
    comments.update([instance._id, 'body', instance.body[0]._id, 'c_date'].join('.'), date)
    instance = comments.read(instance._id)
    instance.body[0].c_date.getTime().should.equal(date.getTime())

    // push
    comments.push(instance._id, { body: [{ name: 'c_comment_segment_b', c_number: 43 }, { name: 'c_comment_segment_c', c_date: 'some string because this one is not really a date, but purposefully used to cerate a parser conflict use case' }] })
    instance = comments.read(instance._id)
    instance.body.length.should.equal(3)
    instance.body[1].name.should.equal('c_comment_segment_b')
    instance.body[2].c_date.should.be.a.String()

    // push path (should work even though grant is lower than required)
    comments.push(instance._id + '/body', { name: 'c_comment_segment_b', c_doc: { c_string: 'abc' } }, { grant: consts.accessLevels.public })
    instance = comments.read(instance._id)
    instance.body.length.should.equal(4)
    instance.body[3].c_doc.c_string.should.equal('abc')

    // pull
    comments.delete([instance._id, 'body', instance.body[2]._id].join('.'), { grant: consts.accessLevels.read })
    instance = comments.read(instance._id, { grant: consts.accessLevels.read })
    instance.body.length.should.equal(3)
    instance.body[2].c_doc.c_string.should.equal('abc');

    // create with bogus path
    (function() {
      try {
        comments.create(post._id, { c_not_a_prop: 'hooah!' }, { grant: consts.accessLevels.delete })
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('create with bogus path should cause an error.')
    }());

    // read with bogus _id
    (function() {
      try {
        comments.read(new ObjectID())
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('read with bogus _id should cause an error.')
    }());

    // update with bogus _id
    (function() {
      try {
        comments.update(new ObjectID())
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('update with bogus _id should cause an error.')
    }());

    // delete with bogus _id
    (function() {
      try {
        comments.delete(new ObjectID())
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('delete with bogus _id should cause an error.')
    }());

    // push with bogus _id
    (function() {
      try {
        comments.push(new ObjectID())
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('delete with bogus _id should cause an error.')
    }());

    // update read-only path
    (function() {
      try {
        comments.update(instance._id + '.created', new Date())
      } catch (err) {
        if (err.errCode === 'cortex.accessDenied.notWritable') {
          return
        }
        throw err
      }
      throw new Error('update read-only path should cause an error.')
    }());

    // update read-only property
    (function() {
      try {
        comments.update(instance._id, { created: new Date() })
      } catch (err) {
        if (err.errCode === 'cortex.accessDenied.notWritable') {
          return
        }
        throw err
      }
      throw new Error('update read-only property should cause an error.')
    }());

    // read invalid path
    (function() {
      try {
        comments.read()
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('read invalid path should cause an error.')
    }());

    // update invalid path
    (function() {
      try {
        comments.update()
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('update invalid path should cause an error.')
    }());

    // creating post on missing post
    (function() {
      try {
        comments.create(new ObjectID(), { body: [{ name: 'c_comment_segment_a', c_number: 42 }] })
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('creating a post on a missing post should cause an error.')
    }());

    // delete invalid path
    (function() {
      try {
        comments.delete()
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('delete invalid path should cause an error.')
    }());

    // push invalid path
    (function() {
      try {
        comments.push()
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('push invalid path should cause an error.')
    }());

    // push to non-array path
    (function() {
      try {
        comments.push(instance._id + '/body/' + instance.body[0]._id + '/c_number', 42, { grant: consts.accessLevels.public })
      } catch (err) {
        if (err.code === 'kUnsupportedOperation') {
          return
        }
        throw err
      }
      throw new Error('push to non-array path should cause an error.')
    }());

    // update non-existent property
    (function() {
      try {
        comments.update(instance._id, { body: [{ _id: instance.body[0]._id, c_nonononono: 'text.txt' }] }, { grant: consts.accessLevels.delete })
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('update non-existent property should cause an error.')
    }())

    // delete
    comments.delete(instance._id)

    list = posts.read(post._id + '/comments')
    list.data.length.should.equal(0)

    // force a connection to the instance.
    connections.create(
      context.object,
      context._id,
      [{
        _id: consts.mocha.principals.provider._id,
        auto: true
      }],
      {
        connectionAppKey: consts.mocha.org.apps.filter(function(app) { return app.clients[0].sessions === true })[0].clients[0].key,
        skipAcl: true,
        forceAuto: true,
        skipNotification: true
      }
    )

    return {
      context: context,
      post: post
    }
  },

  after: function(err, result, ac, model, callback) {

    if (!err) {
      server._current_script_payload = result
    }
    callback(err, true)

  }

}

describe('Scripting', function() {

  it(...wrapper.wrap(__filename, module.exports))

  it(...wrapper.wrap(__filename, {

    principal: 'provider',
    main: function() {

      // noinspection NpmUsedModulesInstalled
      const comments = require('comments'),
            instance = comments.create(consts.mocha.payload.post._id, { body: [{ name: 'c_comment_segment_a', c_number: 42 }] })

      return instance._id
    },

    after: function(err, result, ac, model, callback) {
      if (!err) {
        server._current_script_payload.commentId = result
      }
      callback(err, true)
    }

  }))

  it(...wrapper.wrap(__filename, {

    principal: 'patient',
    main: function() {

      // noinspection NpmUsedModulesInstalled
      const comments = require('comments')

      // delete comment that isn't mine.
      ;(function() {
        try {
          comments.delete(consts.mocha.payload.commentId, { skipTargeting: true, grant: consts.accessLevels.delete })
        } catch (err) {
          if (err.code === 'kAccessDenied') {
            return
          }
          throw err
        }
        throw new Error('update non-existent property should cause an error.')
      }())

      // force delete comment
      comments.delete(consts.mocha.payload.commentId, { skipTargeting: true, skipAcl: true })

      return true
    }

  }))

})
