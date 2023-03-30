'use strict'

const server = require('../../lib/server'),
      consts = require('../../../lib/consts'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      wrapper = require('../../lib/wrapped_sandbox')

server.usingMedia = true

module.exports = {

  main: function() {

    require('should')

    const pluralName = 'c_occurance_tracker',
          objects = require('objects'),
          posts = require('posts')

    let context, dt, options

    // create instance
    context = objects.create(pluralName, { c_string: 'GroupTest' })
    context.c_string.should.equal('GroupTest')

    dt = new Date()
    // create a select of posts to aggregate against.
    for (let i = 0; i < 60; i++) {
      const insert = i % 20
      posts.create('c_occurance_tracker', context._id, 'c_simple_post', { body: [{ name: 'c_simple_segment', c_occurances: insert, c_occurance_time: dt }] }, { grant: consts.accessLevels.delete })
      dt.setHours(dt.getHours() + 8)
    }

    options = {
      grant: consts.accessLevels.read,
      where: {
        'context._id': context._id
      },
      map: 'body',
      limit: 200,
      skip: 0
    }
    posts.list(options)

    options = {
      grant: consts.accessLevels.read,
      where: {
        'context._id': context._id
      },
      group: {
        _id: null,
        count: {
          '$count': '_id'
        }
      }
    }
    posts.list(options)

    options = {
      grant: consts.accessLevels.read,
      where: {
        'context._id': context._id
      },
      map: 'body',
      group: {
        _id: 'body.c_occurances',
        count: {
          '$count': '_id'
        }
      }
    }
    posts.list(options)

    // where and
    options = {
      grant: consts.accessLevels.read,
      where: {
        '$and': [{ 'context._id': context._id }, { 'context.object': 'c_occurance_tracker' }]
      },
      map: 'body',
      group: {
        _id: 'body.c_occurances',
        count: {
          '$count': '_id'
        }
      }
    }
    posts.list(options)

    // where and
    options = {
      grant: consts.accessLevels.read,
      where: {
        '$and': [{ 'context._id': context._id }, { 'context.object': 'c_occurance_tracker' }]
      },
      map: 'body',
      group: {
        _id: {
          'mSec': { '$millisecond': 'created' },
          'num': 'body.c_occurances'
        },
        count: {
          '$count': '_id'
        }
      }
    }
    posts.list(options)

    options = {
      grant: consts.accessLevels.read,
      where: {
        '$and': [{ 'context._id': context._id }, { 'context.object': 'c_occurance_tracker' }]
      },
      map: 'body',
      group: {
        _id: {
          'postYear':
                        {
                          '$year': 'body.c_occurance_time'
                        },
          'postMonth':
                        {
                          '$month': 'body.c_occurance_time'
                        },
          'postDay':
                        {
                          '$dayOfMonth': 'body.c_occurance_time'
                        }
        },
        count: {
          '$count': '_id'
        },
        avg: {
          '$avg': 'body.c_occurances'
        },
        min: {
          '$min': 'body.c_occurances'
        },
        max: {
          '$max': 'body.c_occurances'
        }
      },
      sort: {
        '_id.postYear': -1, '_id.postMonth': -1, '_id.postDay': -1
      }
    }
    posts.list(options)

    options = {
      grant: consts.accessLevels.read,
      where: {
        '$and': [{ 'context._id': context._id }, { 'context.object': 'c_occurance_tracker' }]
      },
      map: 'body',
      group: {
        _id: {
          'Test':
                        {
                          '$substr': [{
                            '$concat': [
                              { '$string': 'body.c_occurances' },
                              { '$string': ' ' },
                              { '$toUpper': { '$string': 'this' } },
                              { '$string': ' ' },
                              { '$toLower': { '$string': 'NTHIS' } }

                            ]
                          }, 0, 5]
                        }
        },
        count: {
          '$count': '_id'
        },
        avg: {
          '$avg': 'body.c_occurances'
        },
        min: {
          '$min': 'body.c_occurances'
        },
        max: {
          '$max': 'body.c_occurances'
        }
      }
    }
    posts.list(options)

    options = {
      grant: consts.accessLevels.read,
      where: {
        '$and': [{ 'context._id': context._id }, { 'context.object': 'c_occurance_tracker' }]
      },
      map: 'body',
      group: {
        _id: {
          setEq: { '$setEquals': [{ '$array': ['cpg', 'mvc', 'kvm'] }, { '$array': ['cpg', 'mvc', 'kvm'] }] },
          setInter: { '$setIntersection': [{ '$array': ['cpg', 'mvc', 'kvm'] }, { '$array': ['cpg', 'kvm'] }] },
          setUnion: { '$setUnion': [{ '$array': ['cpg', 'mvc', 'kvm'] }, { '$array': ['cpg', 'kvm'] }] },
          setDiff: { '$setDifference': [{ '$array': ['cpg', 'mvc', 'kvm'] }, { '$array': ['cpg', 'kvm'] }] },
          setSubset: { '$setIsSubset': [{ '$array': ['cpg', 'mvc', 'kvm'] }, { '$array': ['cpg', 'kvm'] }] }
          // anyTrue: {'$anyElementTrue': [{'$boolean':true}, {'$boolean':false}]},
          // allTrue: {'$allElementsTrue': [{'$boolean':true}, {'$boolean':true}]}

        },
        count: {
          '$count': '_id'
        },
        avg: {
          '$avg': 'body.c_occurances'
        },
        min: {
          '$min': 'body.c_occurances'
        },
        max: {
          '$max': 'body.c_occurances'
        }
      }
    }
    posts.list(options)

    options = {
      grant: consts.accessLevels.read,
      where: {
        '$and': [{ 'context._id': context._id }, { 'context.object': 'c_occurance_tracker' }]
      },
      map: 'body',
      group: {
        _id: {
          num: { '$number': 2.345 },
          int: { '$integer': 5 },
          adder: { '$add': [{ '$number': 2.345 }, { '$number': 5 }, { '$number': 3 }] },
          muller: { '$multiply': [{ '$number': 2.345 }, { '$number': 5 }, { '$number': 3 }] }

        },
        count: {
          '$count': '_id'
        },
        avg: {
          '$avg': 'body.c_occurances'
        },
        min: {
          '$min': 'body.c_occurances'
        },
        max: {
          '$max': 'body.c_occurances'
        }
      }
    }
    posts.list(options)

    return true
  },

  before: function(ac, model, callback) {
    modules.db.models.Object.aclCreate(server.principals.admin, {
      name: 'c_occurance_tracker',
      label: 'Occurance Tracker',
      defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
      createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
      shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
      properties: [
        { label: 'String', name: 'c_string', type: 'String' },
        { label: 'Number', name: 'c_number', type: 'Number' },
        { label: 'Date', name: 'c_date', type: 'Date' }
      ],
      feedDefinition: [{
        label: 'Simple Post',
        postType: 'c_simple_post',
        notifications: true,
        trackViews: true,
        body: [{
          label: 'Simple Segment',
          name: 'c_simple_segment',
          properties: [
            { label: 'String', name: 'c_occurance_description', type: 'String' },
            { label: 'Number', name: 'c_occurances', type: 'Number' },
            { label: 'Date', name: 'c_occurance_time', type: 'Date' },
            { label: 'Boolean', name: 'c_verified', type: 'Boolean' },
            { label: 'Geometry', name: 'c_where_abouts', type: 'Geometry', geoType: 'Point' }

          ]
        }],
        comments: [{
          label: 'Comment Segment A',
          name: 'c_comment_segment_a',
          properties: [
            { label: 'String', name: 'c_string', type: 'String' },
            { label: 'Number', name: 'c_number', type: 'Number' },
            { label: 'Date', name: 'c_date', type: 'Date' }
          ]
        }]
      }]
    }, (err, { ac }) => {
      callback(err, ac)
    })
  },

  after: function(err, result, ac, model, callback) {
    callback(err, result)
  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
