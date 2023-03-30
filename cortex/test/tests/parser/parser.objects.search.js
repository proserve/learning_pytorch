'use strict'

/* global org, script, consts, ObjectID */

require('should')

const async = require('async'),
      utils = require('../../../lib/utils'),
      sandboxed = require('../../lib/sandboxed')

describe('Parser', function() {

  describe('Pipelining', function() {

    before(sandboxed(function() {

      const objects = require('objects')

      objects.create('objects', {
        label: 'Stage 2 Pipeline Test Object',
        name: 'c_pet',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'Name', name: 'c_array', type: 'String', indexed: true, array: true },
          { label: 'Name', name: 'c_name', type: 'String', indexed: true },
          { label: 'Doc',
            name: 'c_doc',
            type: 'Document',
            array: false,
            properties: [
              { label: 'Creator', name: 'c_creator', type: 'Reference', indexed: true, sourceObject: 'account', expandable: true }
            ]
          },
          { label: 'Set',
            name: 'c_set',
            type: 'Set',
            indexed: true,
            documents: [
              { label: 'A', name: 'c_a', properties: [{ label: 'Value from A', name: 'c_value', type: 'String', indexed: true }] },
              { label: 'B', name: 'c_b', properties: [{ label: 'Value from B', name: 'c_value', type: 'Number', array: true, indexed: true }] },
              { label: 'C', name: 'c_c', properties: [{ label: 'Value from C', name: 'c_value', type: 'Any' }] }
            ]
          }
        ],
        objectTypes: [
          { label: 'Dog',
            name: 'c_dog',
            properties: [
              { label: 'Barks', name: 'c_barks', type: 'Boolean', indexed: true },
              { label: 'Set',
                name: 'c_dog_set',
                type: 'Set',
                indexed: true,
                minItems: 1,
                documents: [
                  { label: 'A', name: 'c_a', properties: [{ label: 'A', name: 'c_a', type: 'Boolean', validators: [{ name: 'required' }] }] }
                ]
              },
              { label: 'Set',
                name: 'c_shared_set',
                type: 'Set',
                indexed: true,
                minItems: 0,
                documents: [
                  { label: 'A',
                    name: 'c_a',
                    properties: [
                      { label: 'Value from A', name: 'c_value', type: 'String', indexed: true }
                    ]
                  },
                  { label: 'B',
                    name: 'c_b',
                    properties: [
                      { label: 'Value from B', name: 'c_value', type: 'Date', indexed: true }
                    ]
                  }
                ]
              }
            ]
          },
          { label: 'Cat',
            name: 'c_cat',
            properties: [
              { label: 'Meows', name: 'c_meows', type: 'Boolean', indexed: true, validators: [{ name: 'required' }] },
              { label: 'Set',
                name: 'c_shared_set',
                type: 'Set',
                indexed: true,
                minItems: 0,
                documents: [
                  { label: 'A',
                    name: 'c_a',
                    properties: [
                      { label: 'Value from A', name: 'c_value', type: 'String', indexed: true }
                    ]
                  },
                  { label: 'B',
                    name: 'c_b',
                    properties: [
                      { label: 'Value from B', name: 'c_value', type: 'Date', indexed: true }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })

      // create some pets
      objects.create('c_pets', {
        type: 'c_cat',
        c_meows: false,
        c_array: ['foo', 'bar'],
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_a', c_value: '2' }, { name: 'c_b', c_value: [1, 2, 3] }, { name: 'c_a', c_value: '' }]
      })
      objects.create('c_pets', {
        type: 'c_cat',
        c_meows: true,
        c_array: ['bat', 'baz'],
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_a', c_value: '2' }, { name: 'c_b', c_value: [1, 2, 3] }, { name: 'c_a', c_value: '' }]
      })
      objects.create('c_pets', {
        type: 'c_cat',
        c_meows: true,
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_a', c_value: '2' }, { name: 'c_b', c_value: [1, 2, 3] }, { name: 'c_a', c_value: '' }]
      })
      objects.create('c_pets', {
        type: 'c_dog',
        c_barks: true,
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_b', c_value: [1, 2, 3, 4, 5] }],
        c_dog_set: [{ name: 'c_a', c_a: true }],
        c_shared_set: [{ name: 'c_a', c_value: 'woof woof' }, { name: 'c_b', c_value: new Date() }]
      })
      objects.create('c_pets', {
        type: 'c_dog',
        c_barks: false,
        c_doc: { c_creator: { _id: script.principal._id } },
        c_set: [{ name: 'c_b', c_value: [6, 7, 8, 9] }, { name: 'c_c', c_value: { 'this': { is: 'it' } } }],
        c_dog_set: [{ name: 'c_a', c_a: false }],
        c_shared_set: [{ name: 'c_a', c_value: 'moew meow' }, { name: 'c_b', c_value: new Date() }]
      })

      return objects.list('c_pets')

    }))

    it('various matcher test cases.', sandboxed(function() {

      require('should')

      const Pets = org.objects.c_pets

      Pets.aggregate()
        .match({
          c_barks: true
        })
        .toArray()
        .length.should.equal(1)

      Pets.aggregate()
        .match({
          c_set: {
            $elemMatch: {
              name: 'c_b',
              c_value: { $gt: 3 }
            }
          }
        })
        .toArray()
        .length.should.equal(2)

      Pets.aggregate()
        .match({
          c_array: { $in: ['foo'] },
          c_meows: { $in: [false] }
        })
        .toArray()
        .length.should.equal(1)

      Pets.aggregate()
        .match({
          $and: [{
            c_array: { $in: ['bar'] }
          }, {
            c_meows: { $in: [false] }
          }]
        })
        .toArray()
        .length.should.equal(1)

      Pets.aggregate()
        .match({
          $and: [{
            $or: [{
              c_array: { $in: ['bar'] }
            }, {
              _id: { $gt: new ObjectID(0) }
            }, {
              c_array: { $in: ['baz'] }
            }]
          }, {
            c_meows: { $in: [false] },
            $or: [{
              c_meows: true
            }, {
              c_set: {
                $elemMatch: {
                  name: 'c_a',
                  c_value: '2'
                }
              }
            }]
          }]
        })
        .toArray()
        .length.should.equal(1)

      Pets.aggregate()
        .match({
          'c_set.name': 'c_a'
        })
        .toArray()
        .length.should.equal(3)

      Pets.aggregate()
        .match({
          c_set: {
            $elemMatch: {
              name: 'c_a',
              c_value: '2'
            }
          }
        })
        .toArray()
        .length.should.equal(3)

      Pets.aggregate()
        .match({
          c_set: {
            $all: [{
              $elemMatch: {
                name: 'c_a',
                c_value: '2'
              }
            }, {
              $elemMatch: {
                name: 'c_a',
                c_value: { $in: [''] }
              }
            }]
          }
        })
        .toArray()
        .length.should.equal(3)

      Pets.aggregate()
        .match({
          'c_doc.c_creator._id': { $gt: new ObjectID(0) }
        })
        .toArray()
        .length.should.equal(5)

      Pets.aggregate()
        .match({
          $and: [{
            $or: [{
              c_array: { $in: ['bar'] }
            }]
          }, {
            'c_doc.c_creator._id': { $gt: new ObjectID(0) }
          }]
        })
        .toArray()
        .length.should.equal(1)

    }))

    it('should succeed at all projection operators', function(callback) {

      async.waterfall([

        sandboxed(function() {
          var options = {
            pipeline: [{
              $project: {

                basic_ops_ok: {

                  accumulators_ok: {
                    sum_ok: { $eq: [3, { $sum: [1, 2] }] },
                    avg_ok: { $eq: [1.5, { $avg: [1, 2] }] },
                    max_ok: { $eq: [2, { $max: [1, 2] }] },
                    min_ok: { $eq: [1, { $min: [1, 2] }] },
                    pop_ok: { $eq: [4710, { $floor: { $stdDevPop: [5, 10, 10000] } }] },
                    dev_ok: { $eq: [5769, { $floor: { $stdDevSamp: [5, 10, 10000] } }] }
                  },

                  literals_ok: {
                    literal_ok: { $eq: [{ $literal: 'whatever' }, { $literal: 'whatever' }] },
                    string_ok: { $eq: [{ $string: 'whatever' }, { $string: 'whatever' }] },
                    number_ok: { $eq: [{ $number: 867.5309 }, { $number: 867.5309 }] },
                    integer_ok: { $eq: [{ $integer: 42 }, { $integer: 42 }] },
                    boolean_ok: { $eq: [{ $boolean: false }, { $boolean: false }] },
                    date_ok: { $eq: [{ $date: '2010-12-12' }, { $date: '2010-12-12' }] },
                    objectId_ok: { $eq: [{ $objectId: '4d656461626c6552756c657a' }, { $objectId: '4d656461626c6552756c657a' }] },
                    array_ok: { $eq: [{ $array: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, { $array: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }] },
                    object_ok: { $eq: [{ $object: { this: { is: 'it!' } } }, { $object: { this: { is: 'it!' } } }] }
                  },

                  booleans_ok: {
                    and_ok: { $and: ['_id', 'created'] },
                    or_ok: { $or: ['_id', false] },
                    not_ok: { $not: [{ $literal: false }] }
                  },

                  sets_ok: {
                    setEquals_ok: { $setEquals: [{ $array: [1, 2, 1, 2] }, { $array: [1, 2] }] },
                    setIntersection_ok: { $setEquals: [{ $array: [2, 3] }, { $setIntersection: [{ $array: [1, 2, 3] }, { $array: [2, 3, 4] }] }] },
                    setUnion_ok: { $setEquals: [{ $array: [1, 2, 3, 4] }, { $setUnion: [{ $array: [1, 2, 3] }, { $array: [2, 3, 4] }] }] },
                    setDifference_ok: { $setEquals: [{ $array: [1] }, { $setDifference: [{ $array: [1, 2, 3] }, { $array: [2, 3, 4] }] }] },
                    setIsSubset_ok: { $setIsSubset: [{ $array: [1, 2, 1, 2] }, { $array: [1, 2, 3, 4] }] },
                    anyElementTrue_ok: { $anyElementTrue: [{ $array: [false, false, false, true] }] },
                    allElementsTrue_ok: { $allElementsTrue: [{ $array: [1, 'yes!', { who: 'knew?' }] }] }
                  },

                  comparisons_ok: {
                    cmp_ok: { $eq: [0, { $cmp: ['type', 'type'] }] },
                    eq_ok: { $eq: ['type', 'type'] },
                    gt_ok: { $gt: [2, 1] },
                    gte_ok: { $gte: [2, 2] },
                    lt_ok: { $lt: [1, 2] },
                    lte_ok: { $lte: [2, 2] },
                    ne_ok: { $ne: [1, 2] }
                  },

                  conditionals_ok: {
                    cond_ok: { $cond: ['_id', true, false] },
                    ifNull_ok: { $ifNull: [null, true] }
                  },

                  arithmetic_ok: {

                    trunc_ok: { $eq: [10, { $trunc: 10.8 }] },
                    sqrt_ok: { $eq: [10, { $sqrt: 100 }] },
                    ln_ok: { $eq: [2.302585092994046, { $ln: 10 }] },
                    floor_ok: { $eq: [10, { $floor: 10.8 }] },
                    exp_ok: { $eq: [7.38905609893065, { $exp: 2 }] },
                    ceil_ok: { $eq: [10, { $ceil: 9.500002 }] },
                    abs_ok: { $eq: [10, { $abs: -10 }] },
                    add_ok: { $eq: [{ $date: '2016-08-28T21:05:14.416Z' }, { $add: [1, 100, { $date: '2016-08-28T21:05:14.315Z' }] }] },
                    multiply_ok: { $eq: [9, { $multiply: [3, 3] }] },
                    subtract_ok: { $eq: [1, { $subtract: [3, 2] }] },
                    divide_ok: { $eq: [3, { $divide: [9, 3] }] },
                    mod_ok: { $eq: [3, { $mod: [80, 7] }] },
                    pow_ok: { $eq: [25, { $pow: [5, 2] }] },
                    log_ok: { $eq: [2, { $log: [100, 10] }] }
                  },

                  strings_ok: {
                    concat_ok: { $eq: [{ $string: 'created' }, { $concat: [{ $string: 'cre' }, { $string: 'ated' }] }] },
                    substr_ok: { $eq: [{ $string: 're' }, { $substr: [{ $string: 'created' }, 1, 2] }] },
                    toLower_ok: { $eq: [{ $string: 'created' }, { $toLower: { $string: 'CREATED' } }] },
                    toUpper_ok: { $eq: [{ $string: 'CREATED' }, { $toUpper: { $string: 'created' } }] },
                    strcasecmp_ok: { $eq: [0, { $strcasecmp: [{ $string: 'created' }, { $string: 'CREATED' }] }] }
                  },

                  arrays_ok: {
                    size_ok: {
                      single_element_ok: { $eq: [3, { $size: { $literal: [1, 2, 3] } }] },
                      c_set_has_some_ok: { $lt: [0, { $size: 'c_set' }] },
                      arr_from_others_ok: { $lt: [0, { $size: { $arrayElemAt: [['c_set', 'creator'], 0] } }] }
                    },
                    slice_ok: { $setEquals: [{ $array: [2, 3] }, { $slice: [[1, 2, 3, 4], 1, 2] }] },
                    isArray_ok: { $isArray: 'c_set' },
                    concatArrays_ok: { $eq: [{ $array: [1, 2, 3, 3, 4, 5] }, { $concatArrays: [{ $array: [1, 2, 3] }, { $array: [3, 4, 5] }] }] },
                    arrayElemAt_ok: { $eq: [{ $literal: [{ c: 'd' }] }, { $arrayElemAt: [{ $array: [[{ a: 'b' }], [{ c: 'd' }], [{ e: 'f' }]] }, 1] }] }
                  },

                  dates_ok: {
                    dayOfYear_ok: { $eq: [241, { $dayOfYear: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    dayOfMonth_ok: { $eq: [28, { $dayOfMonth: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    dayOfWeek_ok: { $eq: [1, { $dayOfWeek: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    year_ok: { $eq: [2016, { $year: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    month_ok: { $eq: [8, { $month: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    week_ok: { $eq: [35, { $week: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    hour_ok: { $eq: [21, { $hour: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    minute_ok: { $eq: [5, { $minute: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    second_ok: { $eq: [14, { $second: { $date: '2016-08-28T21:05:14.416Z' } }] },
                    millisecond_ok: { $eq: [416, { $millisecond: { $date: '2016-08-28T21:05:14.416Z' } }] }
                  }
                },

                nested_ok: {
                  $cond: [{ $and: [{
                    $eq: [2.5, { $sum: [1, { $avg: [1, { $max: [{ $min: [1, 2] }, 2] }] }] }]
                  }, {
                    $or: [{
                      $eq: [2.5, { $sum: [1, { $avg: [1, { $max: [{ $min: [1, 2] }, 2] }] }] }]
                    }, {
                      $eq: [2.5, { $sum: [1, { $avg: [1, { $max: [{ $min: [1, 2] }, 2] }] }] }]
                    }]
                  }, {
                    $allElementsTrue: [[1, 2, { $string: 'hooray!' }, { $size: 'c_set' }]]
                  }] }, true, false]
                }

              }
            }]
          }
          // noinspection NpmUsedModulesInstalled
          return require('objects').list('c_pets', options)
        }),

        (results, callback) => {
          results.data.length.should.equal(5)
          utils.visit(results.data[0], {
            fnObj: () => {},
            fnVal: (val, currentKey, parentObject, parentIsArray, depth, fullpath, parentFullpath) => {
              if (val !== true && currentKey !== '_id') {
                throw new Error(fullpath + ' should be true')
              }
            }
          })
          callback()
        }

      ], callback)

    })

  })

})
