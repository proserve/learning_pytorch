'use strict'

const server = require('../../lib/server'),
      consts = require('../../../lib/consts'),
      wrapper = require('../../lib/wrapped_sandbox')

server.usingMedia = true

module.exports = {

  main: function() {

    const pluralName = 'c_postables',
          objects = require('objects'),
          posts = require('posts'),
          should = require('should')

    let context, instance, result, date, list

    // create instance
    context = objects.create(pluralName, { c_string: 'a' })
    context.c_string.should.equal('a')

    // create post
    instance = posts.create('c_postables', context._id, 'c_post_type_a', { body: [{ name: 'c_segment_a', c_number: 42 }] }, { grant: consts.accessLevels.delete })
    instance = posts.read(instance._id, { grant: consts.accessLevels.delete })
    instance.body[0].c_number.should.equal(42)

    // read path
    result = posts.read([instance._id, 'body', instance.body[0]._id, 'c_number'].join('.'))
    should.equal(result, 42);

    // update pointer content path on non-existent file.
    (function() {
      try {
        posts.update([instance._id, 'body', instance.body[0]._id, 'c_file/content'].join('.'), 'text.txt')
        instance = posts.read(instance._id)
      } catch (err) {
        if (err.code === 'kUnsupportedOperation') {
          return
        }
        throw err
      }
      throw new Error('update pointer content path should cause a kUnsupportedOperation error.')
    }())

    // update post
    posts.update(instance._id, { body: [{ _id: instance.body[0]._id, c_string: '42' }] }, { grant: consts.accessLevels.delete })
    instance = posts.read(instance._id)
    instance.body[0].c_string.should.equal('42')

    // update path
    date = new Date(Date.now() - 86400000)
    posts.update([instance._id, 'body', instance.body[0]._id, 'c_date'].join('.'), date)
    instance = posts.read(instance._id)
    instance.body[0].c_date.getTime().should.equal(date.getTime())

    // push
    posts.push(instance._id, { body: [{ name: 'c_segment_b', c_number: 43 }, { name: 'c_segment_c', c_date: 'some string because this one is not really a date, but purposefully used to cerate a parser conflict use case' }] })
    instance = posts.read(instance._id)
    instance.body.length.should.equal(3)
    instance.body[1].name.should.equal('c_segment_b')
    instance.body[2].c_date.should.be.a.String()

    // push path (should work even though grant is lower than required)
    posts.push(instance._id + '/body', { name: 'c_segment_b', c_doc: { c_string: 'abc' } }, { grant: consts.accessLevels.public })
    instance = posts.read(instance._id)
    instance.body.length.should.equal(4)
    instance.body[3].c_doc.c_string.should.equal('abc')

    // pull
    posts.delete([instance._id, 'body', instance.body[2]._id].join('.'), { grant: consts.accessLevels.read })
    instance = posts.read(instance._id)
    instance.body.length.should.equal(3)
    instance.body[2].c_doc.c_string.should.equal('abc')

    // list
    list = posts.list({ where: { _id: instance._id } })
    list.data.length.should.equal(1);

    // update read-only path
    (function() {
      try {
        posts.update(instance._id + '.created', new Date())
      } catch (err) {
        if (err.errCode === 'cortex.accessDenied.notWritable') {
          return
        }
        throw err
      }
      throw new Error('update read-only path should cause an error.')
    }());

    // read invalid path
    (function() {
      try {
        posts.read()
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
        posts.update()
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('update invalid path should cause an error.')
    }());

    // creating post on missing object
    (function() {
      try {
        posts.create('c_not_exists', context._id, 'c_post_type_a', { body: [{ name: 'c_segment_a', c_number: 42 }] })
      } catch (err) {
        if (err.errCode === 'cortex.invalidArgument.object') {
          return
        }
        throw err
      }
      throw new Error('creating a post on an missing object should cause an error.')
    }());

    // creating post on missing post type
    (function() {
      try {
        posts.create('c_postables', context._id, 'c_post_type_NOT', { body: [{ name: 'c_segment_a', c_number: 42 }] })
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('creating a post on an missing post type should cause an error.')
    }());

    // delete invalid path
    (function() {
      try {
        posts.delete()
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
        posts.push()
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
        posts.push(instance._id + '/body/' + instance.body[0]._id + '/c_number', 42, { grant: consts.accessLevels.public })
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
        posts.update(instance._id, { body: [{ _id: instance.body[0]._id, c_nonononono: 'text.txt' }] }, { grant: consts.accessLevels.delete })
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('update non-existent property should cause an error.')
    }())

    // delete
    posts.delete(instance._id)
    list = posts.list({ where: { _id: instance._id }, grant: consts.accessLevels.read }) // throw in a grant
    list.data.length.should.equal(0)

    return true
  },

  after: function(err, result, ac, model, callback) {
    callback(err, result)
  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
