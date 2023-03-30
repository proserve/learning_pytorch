'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-367 - allow limit false on agg', function() {

  it('set limit false in aggregation should produce options with limit:false top level, no pipeline', sandboxed(function() {

    /* global org */
    require('should')
    const options = org.objects.account.aggregate().setOptions({
            pipeline: [{
              $match: {
                _id: { $exists: true }
              }
            }, {
              $sort: {
                'email': -1
              }
            }],
            limit: false
          }).getOptions(),
          inPipeline = options.pipeline.filter(p => Object.keys(p)[0] === '$limit')

    options.limit.should.equal(false)

    inPipeline.length.should.equal(0)

  }))

  it('set limit 100 in aggregation should produce options without top level limit, and limit in pipeline', sandboxed(function() {

    /* global org */
    const should = require('should'),
          options = org.objects.account.aggregate().setOptions({
            pipeline: [{
              $match: {
                _id: { $exists: true }
              }
            }, {
              $sort: {
                'email': -1
              }
            }],
            limit: 100
          }).getOptions(),
          inPipeline = options.pipeline.filter(p => Object.keys(p)[0] === '$limit')

    should.equal(options.limit, undefined)

    inPipeline.length.should.equal(1)

  }))

})
