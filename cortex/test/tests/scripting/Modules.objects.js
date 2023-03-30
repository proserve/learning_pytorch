'use strict'

const server = require('../../lib/server'),
      consts = require('../../../lib/consts'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    /* global ObjectID */

    const name = 'c_script_modules_object_tests',
          objects = require('objects'),
          should = require('should')

    // create
    let faved, list, total, favs, notFavs, instance

    instance = objects.create(name, { c_string: ['a', 'b'] })
    instance.c_string[0].should.equal('a')

    // update
    objects.update(name, instance._id, { c_string: ['c', 'd'] })
    instance = objects.read(name, instance._id)
    instance.c_string[0].should.equal('c')

    // update path
    objects.update(name, instance._id + '.c_string', ['e', 'f'])
    instance = objects.read(name, instance._id)
    instance.c_string[0].should.equal('e')

    // push
    objects.push(name, instance._id, { c_string: ['g'] })
    instance = objects.read(name, instance._id)
    instance.c_string.length.should.equal(3)
    instance.c_string[2].should.equal('g')

    // push path (should work even though grant is lower than required)
    objects.push(name, instance._id + '.c_string', ['h'], { grant: consts.accessLevels.public })
    instance = objects.read(name, instance._id)
    instance.c_string.length.should.equal(4)
    instance.c_string[3].should.equal('h')

    // pull
    objects.delete(name, instance._id + '.c_string.g', { grant: consts.accessLevels.read })
    instance = objects.read(name, instance._id)
    instance.c_string.length.should.equal(3)
    instance.c_string[2].should.equal('h')

    // list
    list = objects.list(name)
    list.data.length.should.equal(1)

    // find
    instance = objects.read(name, { created: instance.created })
    should.exist(instance)

    // delete
    objects.delete(name, instance._id)
    list = objects.list(name, { grant: consts.accessLevels.read }) // throw in a grant
    list.data.length.should.equal(0);

    // call invalid object
    (function invalidName() {
      try {
        objects.list('')
      } catch (err) {
        if (err.errCode === 'cortex.invalidArgument.object') {
          return
        }
        throw err
      }
      throw new Error('A blank plural name should cause an error')
    }());

    // bogus names
    ['create', 'read', 'update', 'delete', 'list', 'push'].forEach(function(command) {
      try {
        // noinspection ES6ModulesDependencies
        objects[command]('bogus', new ObjectID())
      } catch (err) {
        if (err.errCode === 'cortex.invalidArgument.object') {
          return
        }
        throw err
      }
      throw new Error('An invalid object should cause an error')
    });

    // call bogus object
    (function createBogus() {
      try {
        objects.create('bogus')
      } catch (err) {
        if (err.errCode === 'cortex.invalidArgument.object') {
          return
        }
        throw err
      }
      throw new Error('An invalid object should cause an error')
    }())

    // blank or missing payload  be ok.
    objects.create(name)

    // sending a weird payload should be ok.
    objects.create(name, 123)
    objects.create(name, '')
    objects.create(name, true)
    objects.create(name, null)
    objects.create(name, undefined);

    // creating an object with something bad should error out correctly;
    (function createBogus() {
      try {
        objects.create(name, { c_not_a_prop: true })
      } catch (err) {
        if (err.code === 'kNotFound' && err.path === 'c_not_a_prop') {
          return
        }
        throw err
      }
      throw new Error('An invalid prop should cause a kNotFound error on the correct path')
    }())

    // getting favs should work with true and false.
    faved = objects.create(name, { favorite: true })
    total = objects.list(name).data.length
    favs = objects.list(name, { favorites: true }).data.length
    notFavs = objects.list(name, { favorites: false }).data.length
    favs.should.equal(1)
    total.should.equal(favs + notFavs)
    objects.update(name, faved._id, { favorite: false })
    objects.list(name, { favorites: true }).data.length.should.equal(0)
    objects.update(name, faved._id, { favorite: true })
    objects.list(name, { favorites: true }).data.length.should.equal(1);

    // without an _id (read now ok!)
    ['update', 'delete', 'push'].forEach(function(command) {
      try {
        objects[command](name)
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error(command + ' without an _id should fail.')
    });

    // update a path and cause an error (and throw in a grant
    (function() {
      try {
        objects.update(name, faved._id + '/c_not_a_path', 'value', { grant: consts.accessLevels.connected })
      } catch (err) {
        if (err.code === 'kNotFound' && err.path === 'c_not_a_path') {
          return
        }
        throw err
      }
      throw new Error('updating an invalid path should fail.')
    }());

    (function() {
      try {
        objects.update(name, faved._id, { c_not_a_path: 'value' })
      } catch (err) {
        if (err.code === 'kNotFound' && err.path === 'c_not_a_path') {
          return
        }
        throw err
      }
      throw new Error('updating an invalid path should fail.')
    }())

    // read with a path (and a grant - for coverage)
    objects.read(name, faved._id + '/favorite', { grant: consts.accessLevels.read });

    // push with error.
    (function() {
      try {
        objects.push(name, faved._id, { c_not_a_path: [''] })
      } catch (err) {
        if (err.code === 'kNotFound' && err.path === 'c_not_a_path') {
          return
        }
        throw err
      }
      throw new Error('updating an invalid path should fail.')
    }());

    (function() {
      try {
        objects.push(name, faved._id + '/c_not_a_path', [''])
      } catch (err) {
        if (err.code === 'kNotFound' && err.path === 'c_not_a_path') {
          return
        }
        throw err
      }
      throw new Error('updating an invalid path should fail.')
    }())

    return true
  },

  before: function(ac, model, callback) {

    // create a custom object to test push and pull.
    modules.db.models.object.aclCreate(server.principals.admin, {
      name: 'c_script_modules_object_test',
      label: 'Test',
      defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
      createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
      properties: [
        {
          array: true,
          indexed: true,
          label: 'string',
          name: 'c_string',
          type: 'String',
          writable: true,
          canPush: true,
          canPull: true
        }]
    }, callback)
  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
