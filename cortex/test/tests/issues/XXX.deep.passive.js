'use strict'

/* global before */
/* global org, consts */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('XXX - Deep Passive', function() {

    before(sandboxed(function() {

      // create object
      org.objects.Object.insertOne({
        label: 'c_passive_deep_top',
        name: 'c_passive_deep_top',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: []
      }).execute()

      org.objects.Object.insertOne({
        label: 'c_passive_deep_middle',
        name: 'c_passive_deep_middle',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: []
      }).execute()

      org.objects.Object.insertOne({
        label: 'c_passive_deep_bottom',
        name: 'c_passive_deep_bottom',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [{
          label: 'c_foo',
          name: 'c_foo',
          type: 'String'
        }]
      }).execute()

      org.objects.Object.updateOne({ name: 'c_passive_deep_middle' }, { $push: {
        properties: [{
          label: 'c_bottom',
          name: 'c_bottom',
          type: 'Reference',
          expandable: true,
          sourceObject: 'c_passive_deep_bottom'
        }, {
          label: 'c_bottoms',
          name: 'c_bottoms',
          type: 'List',
          readThrough: true,
          sourceObject: 'c_passive_deep_bottom'
        }]
      } }).execute()

      org.objects.Object.updateOne({ name: 'c_passive_deep_top' }, { $push: {
        properties: [{
          label: 'c_middle',
          name: 'c_middle',
          type: 'Reference',
          expandable: true,
          sourceObject: 'c_passive_deep_middle'
        }, {
          label: 'c_middles',
          name: 'c_middles',
          type: 'List',
          readThrough: true,
          sourceObject: 'c_passive_deep_middle'
        }]
      } }).execute()

    }))

    it('should read passively when middle reference is not set', sandboxed(function() {

      let top = org.objects.c_passive_deep_top.insertOne({}).execute()

      return org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .paths('c_middle.c_bottom.c_foo')
        .next()

    }))

    it('should read passively when bottom reference is not set', sandboxed(function() {

      let middle = org.objects.c_passive_deep_middle.insertOne({}).execute(),
          top = org.objects.c_passive_deep_top.insertOne({ c_middle: middle }).execute()

      return org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .paths('c_middle.c_bottom.c_foo')
        .next()

    }))

    it('should read passively when middle reference is deleted', sandboxed(function() {

      let bottom = org.objects.c_passive_deep_bottom.insertOne({ c_foo: 'bar' }).execute(),
          middle = org.objects.c_passive_deep_middle.insertOne({ c_bottom: bottom }).execute(),
          top = org.objects.c_passive_deep_top.insertOne({ c_middle: middle }).execute()

      org.objects.c_passive_deep_middle.deleteOne({ _id: middle }).execute()

      return org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .paths('c_middle.c_bottom.c_foo')
        .next()

    }))

    it('should read passively when bottom reference is deleted', sandboxed(function() {

      const bottom = org.objects.c_passive_deep_bottom.insertOne({ c_foo: 'bar' }).execute(),
            middle = org.objects.c_passive_deep_middle.insertOne({ c_bottom: bottom }).execute(),
            top = org.objects.c_passive_deep_top.insertOne({ c_middle: middle }).execute()

      org.objects.c_passive_deep_bottom.deleteOne({ _id: bottom }).execute()

      return org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .paths('c_middle.c_bottom.c_foo')
        .next()

    }))

    it('should read passively missing properties at various levels through list/reference combinations', sandboxed(function() {

      const bottom = org.objects.c_passive_deep_bottom.insertOne({ c_foo: 'bar' }).execute(),
            middle = org.objects.c_passive_deep_middle.insertOne({ c_bottom: bottom }).execute(),
            top = org.objects.c_passive_deep_top.insertOne({ c_middle: middle }).execute()

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .pathRead(`c_middles.${middle}.c_not_a_prop.5b6c8d2563ee5c100cbc1fc5`)

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .pathRead(`c_middles.${middle}.c_bottom.c_not_a_prop`)

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .pathRead(`c_middle.c_bottoms.c_not_a_prop`)

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .passive()
        .pathRead(`c_middle.c_bottom.c_not_a_prop`)

    }))

    it('should read valid non-passive missing properties at various levels through list/reference combinations', sandboxed(function() {

      require('should')

      const bottom = org.objects.c_passive_deep_bottom.insertOne({ c_foo: 'bar' }).execute(),
            middle = org.objects.c_passive_deep_middle.insertOne({ c_bottom: bottom }).execute(),
            top = org.objects.c_passive_deep_top.insertOne({ c_middle: middle }).execute()

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .pathRead(`c_middle.c_bottom.c_foo`)
        .should
        .equal('bar')

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .pathRead(`c_middle.c_bottoms.${bottom}.c_foo`)
        .should
        .equal('bar')

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .pathRead(`c_middles.${middle}.c_bottom.c_foo`)
        .should
        .equal('bar')

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .pathRead(`c_middles.${middle}.c_bottoms.${bottom}.c_foo`)
        .should
        .equal('bar')

      org.objects.c_passive_deep_top
        .find({ _id: top })
        .paths(`c_middle.c_bottom.c_foo`)
        .next()
        .c_middle
        .c_bottom
        .c_foo
        .should
        .equal('bar')

    }))

  })

})
