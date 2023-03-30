'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Features - CTXAPI-324 - deep readThrough cursor output', function() {

  before(sandboxed(function() {

    /* global script */

    org.objects.org.updateOne({
      code: script.org.code
    }, {
      $push: {
        roles: [{
          name: 'c_ctxapi324_a',
          code: 'c_ctxapi324_a'
        }, {
          name: 'c_ctxapi324_b',
          code: 'c_ctxapi324_b'
        }, {
          name: 'c_ctxapi324_c',
          code: 'c_ctxapi324_c'
        }]
      }
    }).execute()

  }))

  before(sandboxed(function() {

    const name = 'c_ctxapi324',
          { Objects, [name]: Model } = org.objects

    let _id

    Objects.insertOne({
      name,
      label: name,
      defaultAcl: 'owner.delete',
      createAcl: 'account.public'
    }).execute()

    Objects.updateOne(
      {
        name
      },
      {
        $set: {
          uniqueKey: 'c_key'
        },
        $push: {
          properties: [{
            label: 'c_key',
            name: 'c_key',
            type: 'UUID',
            autoGenerate: true,
            indexed: true,
            unique: true,
            writable: false
          }, {
            name: 'c_list_a',
            label: 'c_list_a',
            type: 'List',
            sourceObject: name,
            readThrough: true,
            inheritPropertyAccess: true,
            inheritInstanceRoles: true,
            roles: ['c_ctxapi324_a']
          }, {
            name: 'c_list_b',
            label: 'c_list_b',
            type: 'List',
            sourceObject: name,
            readThrough: true,
            inheritPropertyAccess: true,
            inheritInstanceRoles: true,
            roles: ['c_ctxapi324_b']
          }, {
            name: 'c_list_c',
            label: 'c_list_c',
            type: 'List',
            sourceObject: name,
            readThrough: true,
            inheritPropertyAccess: true,
            inheritInstanceRoles: true,
            roles: ['c_ctxapi324_c']
          }, {
            name: 'c_ref_a',
            label: 'c_ref_a',
            type: 'Reference',
            sourceObject: name,
            expandable: true,
            inheritPropertyAccess: true,
            inheritInstanceRoles: true,
            roles: ['c_ctxapi324_a']
          }, {
            name: 'c_ref_b',
            label: 'c_ref_b',
            type: 'Reference',
            sourceObject: name,
            expandable: true,
            inheritPropertyAccess: true,
            inheritInstanceRoles: true,
            roles: ['c_ctxapi324_b']
          }, {
            name: 'c_ref_c',
            label: 'c_ref_c',
            type: 'Reference',
            sourceObject: name,
            expandable: true,
            inheritPropertyAccess: true,
            inheritInstanceRoles: true,
            roles: ['c_ctxapi324_c']
          }]
        }
      }
    ).execute()

    _id = Model
      .insertOne({})
      .execute()

    Model
      .updateOne({
        _id
      }, {
        $set: {
          c_ref_a: _id,
          c_ref_b: _id,
          c_ref_c: _id
        }
      })
      .execute()

  }))

  it('conventional access regression through various combinations match acl', sandboxed(function() {

    /* global consts, org */

    const name = 'c_ctxapi324',
          { [name]: Model } = org.objects,
          { invert } = require('lodash'),
          roleIds = invert(consts.roles),
          _id = Model.find().next()._id

    function roleToCode(_id) {
      _id = _id.toString()
      if (_id[0] !== '0') {
        return roleIds[_id]
      }
    }

    function shouldHaveAllRoles(path, has, wants) {
      has = has.map(roleToCode).filter(v => v)

      if (!wants.every(role => has.includes(role))) {
        throw new Error(`expected ${path} to include '${wants.join(', ')}' but got '${has.join(', ')}'`)
      }
    }

    // references -------------------

    shouldHaveAllRoles(
      'c_ref_a/c_ref_b/accessRoles',
      Model.find({ _id }).pathRead('c_ref_a/c_ref_b/accessRoles'),
      ['c_ctxapi324_a', 'c_ctxapi324_b']
    )

    shouldHaveAllRoles(
      'c_ref_b/c_ref_c/accessRoles',
      Model.find({ _id }).pathRead('c_ref_b/c_ref_c/accessRoles'),
      ['c_ctxapi324_b', 'c_ctxapi324_c']
    )

    shouldHaveAllRoles(
      'c_ref_c/c_ref_a/accessRoles',
      Model.find({ _id }).pathRead('c_ref_c/c_ref_a/accessRoles'),
      ['c_ctxapi324_c', 'c_ctxapi324_c']
    )

    shouldHaveAllRoles(
      'c_ref_a/c_ref_b/c_ref_c/accessRoles',
      Model.find({ _id }).pathRead('c_ref_a/c_ref_b/c_ref_c/accessRoles'),
      ['c_ctxapi324_a', 'c_ctxapi324_b', 'c_ctxapi324_c']
    )

    // lists -------------------

    shouldHaveAllRoles(
      `c_list_a/${_id}/c_list_b/${_id}/accessRoles`,
      Model.find({ _id }).pathRead(`c_list_a/${_id}/c_list_b/${_id}/accessRoles`),
      ['c_ctxapi324_a', 'c_ctxapi324_b']
    )

    shouldHaveAllRoles(
      `c_list_b/${_id}/c_list_c/${_id}/accessRoles`,
      Model.find({ _id }).pathRead(`c_list_b/${_id}/c_list_c/${_id}/accessRoles`),
      ['c_ctxapi324_b', 'c_ctxapi324_c']
    )

    shouldHaveAllRoles(
      `c_list_c/${_id}/c_list_c/${_id}/accessRoles`,
      Model.find({ _id }).pathRead(`c_list_c/${_id}/c_list_a/${_id}/accessRoles`),
      ['c_ctxapi324_a', 'c_ctxapi324_c']
    )

    shouldHaveAllRoles(
      `c_list_a/${_id}/c_list_b/${_id}/c_list_c/${_id}/accessRoles`,
      Model.find({ _id }).pathRead(`c_list_a/${_id}/c_list_b/${_id}/c_list_c/${_id}/accessRoles`),
      ['c_ctxapi324_a', 'c_ctxapi324_b', 'c_ctxapi324_c']
    )

    // mixed -------------------

    shouldHaveAllRoles(
      `c_ref_a/c_list_b/${_id}/accessRoles`,
      Model.find({ _id }).pathRead(`c_ref_a/c_list_b/${_id}/accessRoles`),
      ['c_ctxapi324_a', 'c_ctxapi324_b']
    )

    shouldHaveAllRoles(
      `c_list_a/${_id}/c_ref_b/accessRoles`,
      Model.find({ _id }).pathRead(`c_list_a/${_id}/c_ref_b/accessRoles`),
      ['c_ctxapi324_a', 'c_ctxapi324_b']
    )

  }))

  it('read through many levels should produce a cursor', sandboxed(function() {

    /* global consts, org */

    const name = 'c_ctxapi324',
          { [name]: Model } = org.objects,
          { invert } = require('lodash'),
          roleIds = invert(consts.roles),
          _id = Model.find().next()._id

    function roleToCode(_id) {
      _id = _id.toString()
      if (_id[0] !== '0') {
        return roleIds[_id]
      }
    }

    function shouldHaveAllRoles(path, has, wants = null, dont = null) {
      has = has.map(roleToCode).filter(v => v)
      if (wants && !wants.every(role => has.includes(role))) {
        throw new Error(`expected ${path} to include '${wants.join(', ')}' but got '${has.join(', ')}'`)
      }
      if (dont && dont.some(role => has.includes(role))) {
        throw new Error(`expected ${path} not to include '${dont.join(', ')}' but got '${has.join(', ')}'`)
      }
    }

    shouldHaveAllRoles(
      `${_id}/c_list_a/${_id}/c_list_b`,
      Model.aggregate().pathPrefix(`${_id}/c_list_a/${_id}/c_list_b`)
        .project({
          accessRoles: 1
        })
        .next()
        .accessRoles,
      ['c_ctxapi324_a', 'c_ctxapi324_b']
    )

    shouldHaveAllRoles(
      `${_id}/c_ref_a/c_ref_c/c_list_a/${_id}/c_list_c`,
      Model.aggregate().pathPrefix(`${_id}/c_ref_a/c_ref_c/c_list_a/${_id}/c_list_c`)
        .project({
          accessRoles: 1
        })
        .next()
        .accessRoles,
      ['c_ctxapi324_a', 'c_ctxapi324_c'],
      ['c_ctxapi324_b']
    )

  }))

  it('read through using unique key', sandboxed(function() {

    /* global consts, org */

    const name = 'c_ctxapi324',
          { [name]: Model } = org.objects,
          { invert } = require('lodash'),
          roleIds = invert(consts.roles),
          { c_key: key } = Model.find().next()

    function roleToCode(_id) {
      _id = _id.toString()
      if (_id[0] !== '0') {
        return roleIds[_id]
      }
    }

    function shouldHaveAllRoles(path, has, wants = null, dont = null) {
      has = has.map(roleToCode).filter(v => v)
      if (wants && !wants.every(role => has.includes(role))) {
        throw new Error(`expected ${path} to include '${wants.join(', ')}' but got '${has.join(', ')}'`)
      }
      if (dont && dont.some(role => has.includes(role))) {
        throw new Error(`expected ${path} not to include '${dont.join(', ')}' but got '${has.join(', ')}'`)
      }
    }

    shouldHaveAllRoles(
      `${key}/c_list_a/${key}/c_list_b`,
      Model.aggregate().pathPrefix(`${key}/c_list_a/${key}/c_list_b`)
        .project({
          accessRoles: 1
        })
        .next()
        .accessRoles,
      ['c_ctxapi324_a', 'c_ctxapi324_b']
    )

    shouldHaveAllRoles(
      `${key}/c_ref_a/c_ref_c/c_list_a/${key}/c_list_c`,
      Model.aggregate().pathPrefix(`${key}/c_ref_a/c_ref_c/c_list_a/${key}/c_list_c`)
        .project({
          accessRoles: 1
        })
        .next()
        .accessRoles,
      ['c_ctxapi324_a', 'c_ctxapi324_c'],
      ['c_ctxapi324_b']
    )

  }))

})
