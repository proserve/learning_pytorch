'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed'),
      _ = require('lodash')

describe('Features - Localization Parser', function() {

  describe('CTXAPI-167 - querying localized data', function() {

    before(sandboxed(function() {

      const attributes = {
              indexed: true,
              removable: true,
              localization: {
                enabled: true,
                strict: false,
                fallback: true,
                acl: [],
                fixed: '',
                valid: ['en_US', 'es_ES']
              }
            },
            countries = [
              {
                c_key: 'c_us',
                c_regions: [{ c_region_key: 'c_south' }, { c_region_key: 'c_east' }],
                locales: {
                  c_country_name: [
                    { locale: 'en_US', value: 'United States' },
                    { locale: 'es_ES', value: 'Estados Unidos' }
                  ],
                  c_country_states: [
                    { locale: 'en_US', value: ['California', 'Florida', 'New York'] },
                    { locale: 'es_ES', value: ['California', 'Florida', 'Nueva York'] }
                  ],
                  c_country_info: {
                    c_main_language: [
                      { locale: 'en_US', value: 'English' },
                      { locale: 'es_ES', value: 'Ingles' }
                    ]
                  },
                  c_regions: [
                    {
                      c_region_key: 'c_south',
                      c_region_name: [
                        { locale: 'en_US', value: 'South' },
                        { locale: 'es_ES', value: 'Sur' }
                      ],
                      c_region_sections: [
                        { locale: 'en_US', value: ['section A', 'section ABC'] },
                        { locale: 'es_ES', value: ['seccion A', 'seccion ABC'] }
                      ]
                    },
                    {
                      c_region_key: 'c_east',
                      c_region_name: [
                        { locale: 'en_US', value: 'East' },
                        { locale: 'es_ES', value: 'Este' }
                      ],
                      c_region_sections: [
                        { locale: 'en_US', value: ['section D', 'section E'] },
                        { locale: 'es_ES', value: ['seccion D', 'seccion E'] }
                      ]
                    }
                  ]
                }
              },
              {
                c_key: 'c_it',
                c_regions: [{ c_region_key: 'c_north' }, { c_region_key: 'c_west' }],
                locales: {
                  c_country_name: [
                    { locale: 'en_US', value: 'Italy' },
                    { locale: 'es_ES', value: 'Italia' }
                  ],
                  c_country_states: [
                    { locale: 'en_US', value: ['Naples', 'Sicily'] },
                    { locale: 'es_ES', value: ['Napoles', 'Sicilia'] }
                  ],
                  c_country_info: {
                    c_main_language: [
                      { locale: 'en_US', value: 'Italian' },
                      { locale: 'es_ES', value: 'Italiano' }
                    ]
                  },
                  c_regions: [
                    {
                      c_region_key: 'c_north',
                      c_region_name: [
                        { locale: 'en_US', value: 'North' },
                        { locale: 'es_ES', value: 'Norte' }
                      ],
                      c_region_sections: [
                        { locale: 'en_US', value: ['section A', 'section ABC'] },
                        { locale: 'es_ES', value: ['seccion A', 'seccion ABC'] }
                      ]
                    },
                    {
                      c_region_key: 'c_west',
                      c_region_name: [
                        { locale: 'en_US', value: 'Weast' },
                        { locale: 'es_ES', value: 'Oeste' }
                      ],
                      c_region_sections: [
                        { locale: 'en_US', value: ['section D', 'section E'] },
                        { locale: 'es_ES', value: ['seccion D', 'seccion E'] }
                      ]
                    }
                  ]
                }
              }
            ],
            subTypeInstances = [
              {
                type: 'c_type_a',
                c_key: 'c_key_of_a',
                locales: {
                  c_value: [
                    { locale: 'en_US', value: 'Value of A' },
                    { locale: 'es_ES', value: 'Valor de A' }
                  ],
                  c_document: {
                    c_value: [
                      { locale: 'en_US', value: 'Value of A - Document' },
                      { locale: 'es_ES', value: 'Valor de A - Documento' }
                    ]
                  }
                }
              },
              {
                type: 'c_type_b',
                c_key: 'c_key_of_b',
                c_value: true
              },
              {
                type: 'c_type_c',
                c_key: 'c_key_of_c',
                c_value: 'Value of C - Non Localized'
              },
              {
                type: 'c_type_d',
                c_key: 'c_key_of_d',
                locales: {
                  c_value: [
                    { locale: 'en_US', value: 'Value of D' },
                    { locale: 'es_ES', value: 'Valor de D' }
                  ],
                  c_document: {
                    c_value: [
                      { locale: 'en_US', value: 'Value of D - Document' },
                      { locale: 'es_ES', value: 'Valor de D - Documento' }
                    ]
                  }
                }
              }
            ]

      org.objects.objects.insertOne({
        label: 'CTXAPI-167',
        name: 'c_ctxapi_167',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        uniqueKey: 'c_key',
        properties: [{
          name: 'c_key',
          label: 'Key',
          type: 'String',
          indexed: true,
          unique: true,
          validators: [{ name: 'customName' }]
        }, {
          name: 'c_country_name',
          label: 'Country Name',
          type: 'String',
          ...attributes
        }, {
          name: 'c_country_states',
          label: 'States',
          type: 'String',
          array: true,
          ...attributes
        }, {
          name: 'c_country_info',
          label: 'Info',
          type: 'Document',
          properties: [{
            name: 'c_population',
            label: 'Population',
            type: 'Number',
            indexed: true,
            removable: true
          }, {
            name: 'c_main_language',
            label: 'Main Language',
            type: 'String',
            ...attributes
          }]
        }, {
          name: 'c_regions',
          label: 'Regions',
          type: 'Document',
          array: true,
          uniqueKey: 'c_region_key',
          properties: [{
            name: 'c_region_key',
            label: 'Key',
            type: 'String',
            validators: [{ name: 'customName' }, { name: 'uniqueInArray' }]
          }, {
            name: 'c_region_name',
            label: 'Region Name',
            type: 'String',
            ...attributes
          }, {
            name: 'c_region_sections',
            label: 'Sections',
            type: 'String',
            array: true,
            ...attributes
          }]
        }]
      }).execute()

      org.objects.objects.insertOne({
        label: 'CTXAPI-167-with-subtypes',
        name: 'c_ctxapi_167_subtypes',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [{
          name: 'c_key',
          label: 'Key',
          type: 'String',
          indexed: true,
          unique: true,
          validators: [{ name: 'customName' }]
        }],
        objectTypes: [
          {
            label: 'A',
            name: 'c_type_a',
            properties: [
              {
                label: 'Localized String from A',
                name: 'c_value',
                type: 'String',
                ...attributes
              },
              {
                label: 'Document from A',
                name: 'c_document',
                type: 'Document',
                properties: [
                  {
                    label: 'Localized String from A Document',
                    name: 'c_value',
                    type: 'String',
                    ...attributes
                  }
                ]
              }
            ]
          },
          {
            label: 'B',
            name: 'c_type_b',
            properties: [
              {
                label: 'Boolean from B',
                name: 'c_value',
                type: 'Boolean',
                indexed: true
              }
            ]
          },
          {
            label: 'C',
            name: 'c_type_c',
            properties: [
              {
                label: 'Non Localized String from C',
                name: 'c_value',
                type: 'String',
                indexed: true,
                removable: true,
                localization: {
                  enabled: false
                }
              }
            ]
          },
          {
            label: 'D',
            name: 'c_type_d',
            properties: [
              {
                label: 'Localized String from D',
                name: 'c_value',
                type: 'String',
                ...attributes
              },
              {
                label: 'Document from D',
                name: 'c_document',
                type: 'Document',
                properties: [
                  {
                    label: 'Localized String from D Document',
                    name: 'c_value',
                    type: 'String',
                    ...attributes
                  }
                ]
              }
            ]
          }
        ]
      }).execute()

      countries.forEach((c) => {
        org.objects.c_ctxapi_167.insertOne(c).execute()
      })

      subTypeInstances.forEach((t) => {
        org.objects.c_ctxapi_167_subtypes.insertOne(t).execute()
      })
    }))

    it('query with single match', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({ 'c_country_name': 'United States' }).count(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({ 'c_country_name': 'United States' }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({ 'c_country_name': 'Estados Unidos' }).locale('es_ES').count()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.should.equal(1)
        result.singleOtherLocaleNotFound.should.equal(0)
        result.singleOtherLocaleFound.should.equal(1)
        done()
      })
    })

    it('query with $in match', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({ 'c_country_states': { $in: ['Texas', 'New York'] } }).count(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({ 'c_country_states': { $in: ['Texas', 'New York'] } }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({ 'c_country_states': { $in: ['Texas', 'Nueva York'] } }).locale('es_ES').count()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.should.equal(1)
        result.singleOtherLocaleNotFound.should.equal(0)
        result.singleOtherLocaleFound.should.equal(1)
        done()
      })
    })

    it('query with $all match', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({ 'c_country_states': { $all: ['California', 'New York'] } }).count(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({ 'c_country_states': { $all: ['California', 'New York'] } }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({ 'c_country_states': { $all: ['California', 'Nueva York'] } }).locale('es_ES').count()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.should.equal(1)
        result.singleOtherLocaleNotFound.should.equal(0)
        result.singleOtherLocaleFound.should.equal(1)
        done()
      })
    })

    it('query with $elemMatch match', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({ 'c_regions': { $elemMatch: { 'c_region_name': { $in: ['North', 'West'] } } } }).count(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({ 'c_regions': { $elemMatch: { 'c_region_name': { $in: ['North', 'West'] } } } }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({ 'c_regions': { $elemMatch: { 'c_region_name': { $in: ['Norte', 'Oeste'] } } } }).locale('es_ES').count()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.should.equal(1)
        result.singleOtherLocaleNotFound.should.equal(0)
        result.singleOtherLocaleFound.should.equal(1)
        done()
      })
    })

    it('query with $project', (done) => {

      /* global org, consts */

      require('should')

      sandboxed(function() {

        const enUS = org.objects.c_ctxapi_167.aggregate([
                { $project: {
                  merged: {
                    $concat: [
                      { $literal: 'Country: ' },
                      'c_country_name'
                    ]
                  }
                } }
              ]).toArray(),
              esES = org.objects.c_ctxapi_167.aggregate([
                { $project: {
                  merged: {
                    $concat: [
                      { $literal: 'Country: ' },
                      'c_country_name'
                    ]
                  }
                } }
              ]).locale('es_ES').toArray()

        return { en_US: enUS, es_ES: esES }

      })((err, result) => {
        if (err) return done(err)
        result.en_US[0].merged.should.equal('Country: United States')
        result.en_US[1].merged.should.equal('Country: Italy')
        result.es_ES[0].merged.should.equal('Country: Estados Unidos')
        result.es_ES[1].merged.should.equal('Country: Italia')
        done()
      })
    })

    it('query with $group', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const enUS = org.objects.c_ctxapi_167.aggregate([
                {
                  $group: {
                    _id: {
                      '$concat': [
                        { '$string': 'Country:' },
                        { '$string': ' ' },
                        'c_country_name',
                        { '$string': ' - ' },
                        'c_country_info.c_main_language'
                      ]
                    },
                    total: {
                      $count: '_id'
                    }
                  }
                },
                {
                  $sort: {
                    _id: 1
                  }
                }
              ]).toArray(),
              esES = org.objects.c_ctxapi_167.aggregate([
                {
                  $group: {
                    _id: {
                      '$concat': [
                        { '$string': 'Country:' },
                        { '$string': ' ' },
                        'c_country_name',
                        { '$string': ' - ' },
                        'c_country_info.c_main_language'
                      ]
                    },
                    total: {
                      $count: '_id'
                    }
                  }
                },
                {
                  $sort: {
                    _id: 1
                  }
                }
              ]).locale('es_ES').toArray()
        return { en_US: enUS, es_ES: esES }
      })((err, result) => {
        if (err) return done(err)
        result.en_US[0]._id.should.equal('Country: Italy - Italian')
        result.en_US[0].total.should.equal(1)
        result.en_US[1]._id.should.equal('Country: United States - English')
        result.en_US[1].total.should.equal(1)
        result.es_ES[0]._id.should.equal('Country: Estados Unidos - Ingles')
        result.es_ES[0].total.should.equal(1)
        result.es_ES[1]._id.should.equal('Country: Italia - Italiano')
        result.es_ES[1].total.should.equal(1)
        done()
      })
    })

    it('query with combined $match, $project and $group', (done) => {
      require('should')
      sandboxed(function() {
        const enUS = org.objects.c_ctxapi_167.aggregate([
                { $match: { $or: [{ 'c_country_info.c_main_language': 'English' }, { 'c_country_info.c_main_language': 'Italian' }] } },
                { $project: {
                  'c_country_name': 1,
                  'key': {
                    '$concat': [
                      { '$string': 'Country:' },
                      { '$string': ' ' },
                      'c_country_name',
                      { '$string': ' - ' },
                      'c_country_info.c_main_language'
                    ]
                  }
                } },
                {
                  $group: {
                    _id: 'key',
                    total: {
                      $count: '_id'
                    }
                  }
                },
                {
                  $sort: {
                    _id: 1
                  }
                }
              ]).toArray(),
              esES = org.objects.c_ctxapi_167.aggregate([
                { $match: { $or: [{ 'c_country_info.c_main_language': 'Ingles' }, { 'c_country_info.c_main_language': 'Italiano' }] } },
                { $project: {
                  'c_country_name': 1,
                  'key': {
                    '$concat': [
                      { '$string': 'Country:' },
                      { '$string': ' ' },
                      'c_country_name',
                      { '$string': ' - ' },
                      'c_country_info.c_main_language'
                    ]
                  }
                } },
                {
                  $group: {
                    _id: 'key',
                    total: {
                      $count: '_id'
                    }
                  }
                },
                {
                  $sort: {
                    _id: 1
                  }
                }
              ]).locale('es_ES').toArray()

        return { en_US: enUS, es_ES: esES }
      })((err, result) => {
        if (err) return done(err)
        result.en_US[0]._id.should.equal('Country: Italy - Italian')
        result.en_US[0].total.should.equal(1)
        result.en_US[1]._id.should.equal('Country: United States - English')
        result.en_US[1].total.should.equal(1)
        result.es_ES[0]._id.should.equal('Country: Estados Unidos - Ingles')
        result.es_ES[0].total.should.equal(1)
        result.es_ES[1]._id.should.equal('Country: Italia - Italiano')
        result.es_ES[1].total.should.equal(1)
        done()
      })
    })

    it('query with $and match', (done) => {
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({ $and: [{ 'c_country_info.c_main_language': 'English' }, { 'c_country_name': 'United States' }] }).toArray(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({ $and: [{ 'c_country_info.c_main_language': 'English' }, { 'c_country_name': 'United States' }] }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({ $and: [{ 'c_country_info.c_main_language': 'Ingles' }, { 'c_country_name': 'Estados Unidos' }] }).locale('es_ES').toArray()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.length.should.equal(1)
        result.single[0].c_country_name.should.equal('United States')
        result.single[0].c_country_info.c_main_language.should.equal('English')

        result.singleOtherLocaleNotFound.should.equal(0)

        result.singleOtherLocaleFound.length.should.equal(1)
        result.singleOtherLocaleFound[0].c_country_name.should.equal('Estados Unidos')
        result.singleOtherLocaleFound[0].c_country_info.c_main_language.should.equal('Ingles')
        done()
      })
    })

    it('query with single $or match', (done) => {
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({ $or: [{ 'c_country_info.c_main_language': 'English' }, { 'c_country_name': 'Italy' }] }).toArray(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({ $or: [{ 'c_country_info.c_main_language': 'English' }, { 'c_country_name': 'Italy' }] }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({ $or: [{ 'c_country_info.c_main_language': 'Ingles' }, { 'c_country_name': 'Italia' }] }).locale('es_ES').toArray()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.length.should.equal(2)

        var usa = _.find(result.single, country => country.c_key === 'c_us'),
            italy = _.find(result.single, country => country.c_key === 'c_it')

        usa.c_country_name.should.equal('United States')
        usa.c_country_info.c_main_language.should.equal('English')
        italy.c_country_name.should.equal('Italy')
        italy.c_country_info.c_main_language.should.equal('Italian')

        result.singleOtherLocaleNotFound.should.equal(0)

        result.singleOtherLocaleFound.length.should.equal(2)

        usa = _.find(result.singleOtherLocaleFound, country => country.c_key === 'c_us')
        italy = _.find(result.singleOtherLocaleFound, country => country.c_key === 'c_it')

        usa.c_country_name.should.equal('Estados Unidos')
        usa.c_country_info.c_main_language.should.equal('Ingles')
        italy.c_country_name.should.equal('Italia')
        italy.c_country_info.c_main_language.should.equal('Italiano')

        done()
      })
    })

    it('query with combined $and $or match', (done) => {
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({
                $and: [
                  { 'c_country_info.c_main_language': 'English' },
                  {
                    $or: [
                      { 'c_country_name': 'United States' },
                      { 'c_country_info.c_main_language': 'Italiano' }]
                  }]
              }).toArray(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({
                $and: [
                  { 'c_country_info.c_main_language': 'English' },
                  {
                    $or: [
                      { 'c_country_name': 'United States' },
                      { 'c_country_info.c_main_language': 'Italiano' }]
                  }]
              }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({
                $and: [
                  { 'c_country_info.c_main_language': 'Ingles' },
                  {
                    $or: [
                      { 'c_country_name': 'Estados Unidos' },
                      { 'c_country_info.c_main_language': 'Italiano' }]
                  }]
              }).locale('es_ES').toArray()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.length.should.equal(1)
        result.single[0].c_country_name.should.equal('United States')
        result.single[0].c_country_info.c_main_language.should.equal('English')

        result.singleOtherLocaleNotFound.should.equal(0)

        result.singleOtherLocaleFound.length.should.equal(1)
        result.singleOtherLocaleFound[0].c_country_name.should.equal('Estados Unidos')
        result.singleOtherLocaleFound[0].c_country_info.c_main_language.should.equal('Ingles')
        done()
      })
    })

    it('query with combined $or $and $in match', (done) => {
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({
                $or: [
                  { 'c_country_info.c_main_language': 'English' },
                  {
                    $and: [
                      { 'c_country_name': 'Italy' },
                      { 'c_country_states': { $in: ['Naples', 'Sicily'] } }
                    ]
                  }]
              }).toArray(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({
                $or: [
                  { 'c_country_info.c_main_language': 'English' },
                  {
                    $and: [
                      { 'c_country_name': 'Italy' },
                      { 'c_country_states': { $in: ['Naples', 'Sicily'] } }
                    ]
                  }]
              }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({
                $or: [
                  { 'c_country_info.c_main_language': 'Ingles' },
                  {
                    $and: [
                      { 'c_country_name': 'Italia' },
                      { 'c_country_states': { $in: ['Napoles', 'Sicilia'] } }
                    ]
                  }]
              }).locale('es_ES').toArray()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.length.should.equal(2)

        var usa = _.find(result.single, country => country.c_key === 'c_us'),
            italy = _.find(result.single, country => country.c_key === 'c_it')

        usa.c_country_name.should.equal('United States')
        usa.c_country_info.c_main_language.should.equal('English')
        italy.c_country_name.should.equal('Italy')
        italy.c_country_info.c_main_language.should.equal('Italian')

        result.singleOtherLocaleNotFound.should.equal(0)

        result.singleOtherLocaleFound.length.should.equal(2)

        usa = _.find(result.singleOtherLocaleFound, country => country.c_key === 'c_us')
        italy = _.find(result.singleOtherLocaleFound, country => country.c_key === 'c_it')

        usa.c_country_name.should.equal('Estados Unidos')
        usa.c_country_info.c_main_language.should.equal('Ingles')
        italy.c_country_name.should.equal('Italia')
        italy.c_country_info.c_main_language.should.equal('Italiano')

        done()
      })
    })

    // Localized String vs Localized String
    it('query with different objectTypes and localized Strings that are similarly named', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const inQueryUSLocale = org.objects.c_ctxapi_167_subtypes.find({
                'c_value': {
                  $in: [
                    'Value of A',
                    'Valor de D'
                  ]
                }
              }).toArray(),
              inQueryESLocale = org.objects.c_ctxapi_167_subtypes.find({
                'c_value': {
                  $in: [
                    'Value of A',
                    'Valor de D'
                  ]
                }
              }).locale('es_ES').toArray(),
              orQueryUSLocale = org.objects.c_ctxapi_167_subtypes.find({
                $or: [
                  { 'c_value': 'Value of A' },
                  { 'c_value': 'Valor de D' }
                ]
              }).toArray(),
              orQueryESLocale = org.objects.c_ctxapi_167_subtypes.find({
                $or: [
                  { 'c_value': 'Valor de A' },
                  { 'c_value': 'Valor de D' }
                ]
              }).locale('es_ES').toArray()
        return { inQueryUSLocale, inQueryESLocale, orQueryUSLocale, orQueryESLocale }
      })((err, result) => {
        if (err) return done(err)

        result.inQueryUSLocale.length.should.equal(1)
        result.inQueryUSLocale[0].c_key.should.equal('c_key_of_a')
        result.inQueryESLocale.length.should.equal(1)
        result.inQueryESLocale[0].c_key.should.equal('c_key_of_d')
        result.orQueryUSLocale.length.should.equal(1)
        result.orQueryUSLocale[0].c_key.should.equal('c_key_of_a')

        result.orQueryESLocale.length.should.equal(2)

        const valueOfA = _.find(result.orQueryESLocale, r => r.c_key === 'c_key_of_a'),
              valueOfD = _.find(result.orQueryESLocale, r => r.c_key === 'c_key_of_d')

        valueOfA.c_value.should.equal('Valor de A')
        valueOfD.c_value.should.equal('Valor de D')

        done()
      })
    })

    // Boolean vs Localized String
    it('query on objectTypes with Boolean and localized String properties that are similarly named', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const inQueryUSLocale = org.objects.c_ctxapi_167_subtypes.find({
                'c_value': {
                  $in: [
                    'Valor de D',
                    'yes'
                  ]
                }
              }).toArray(),
              inQueryESLocale = org.objects.c_ctxapi_167_subtypes.find({
                'c_value': {
                  $in: [
                    'Valor de D',
                    false
                  ]
                }
              }).locale('es_ES').toArray(),
              orQueryUSLocale = org.objects.c_ctxapi_167_subtypes.find({
                $or: [
                  { 'c_value': 'Value of D' },
                  { 'c_value': 'Valor de A' },
                  { 'c_value': 'y' }
                ]
              }).toArray(),
              orQueryESLocale = org.objects.c_ctxapi_167_subtypes.find({
                $or: [
                  { 'c_value': 'Value of A' },
                  { 'c_value': 'Valor de D' },
                  { 'c_value': 'true' }
                ]
              }).locale('es_ES').toArray()

        return { inQueryUSLocale, inQueryESLocale, orQueryUSLocale, orQueryESLocale }
      })((err, result) => {
        if (err) return done(err)

        result.inQueryUSLocale.length.should.equal(1)
        result.inQueryUSLocale[0].c_key.should.equal('c_key_of_b')
        result.inQueryUSLocale[0].c_value.should.equal(true)

        result.inQueryESLocale.length.should.equal(1)
        result.inQueryESLocale[0].c_key.should.equal('c_key_of_d')
        result.inQueryESLocale[0].c_value.should.equal('Valor de D')

        result.orQueryUSLocale.length.should.equal(2)

        var valueOfB = _.find(result.orQueryUSLocale, r => r.c_key === 'c_key_of_b'),
            valueOfD = _.find(result.orQueryUSLocale, r => r.c_key === 'c_key_of_d')

        valueOfB.c_value.should.equal(true)
        valueOfD.c_value.should.equal('Value of D')

        result.orQueryESLocale.length.should.equal(2)

        valueOfB = _.find(result.orQueryESLocale, r => r.c_key === 'c_key_of_b')
        valueOfD = _.find(result.orQueryESLocale, r => r.c_key === 'c_key_of_d')

        valueOfB.c_value.should.equal(true)
        valueOfD.c_value.should.equal('Valor de D')

        done()
      })
    })

    // Localized vs Non Localized String
    it('query on objectTypes with localized and non localized String properties that are similarly named', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const inQueryUSLocale = org.objects.c_ctxapi_167_subtypes.find({
                'c_value': {
                  $in: [
                    'Value of C - Non Localized',
                    'Valor de D'
                  ]
                }
              }).toArray(),
              inQueryESLocale = org.objects.c_ctxapi_167_subtypes.find({
                'c_value': {
                  $in: [
                    'Value of C - Non Localized',
                    'Valor de D'
                  ]
                }
              }).locale('es_ES').toArray(),
              orQueryUSLocale = org.objects.c_ctxapi_167_subtypes.find({
                $or: [
                  { 'c_value': 'Value of C - Non Localized' },
                  { 'c_value': 'Valor de D' }
                ]
              }).toArray(),
              orQueryESLocale = org.objects.c_ctxapi_167_subtypes.find({
                $or: [
                  { 'c_value': 'Value of C - Non Localized' },
                  { 'c_value': 'Valor de D' }
                ]
              }).locale('es_ES').toArray()

        return { inQueryUSLocale, inQueryESLocale, orQueryUSLocale, orQueryESLocale }
      })((err, result) => {
        if (err) return done(err)
        result.inQueryUSLocale.length.should.equal(1)
        result.inQueryUSLocale[0].c_key.should.equal('c_key_of_c')

        result.inQueryESLocale.length.should.equal(2)

        let valueOfC = _.find(result.inQueryESLocale, r => r.c_key === 'c_key_of_c'),
            valueOfD = _.find(result.inQueryESLocale, r => r.c_key === 'c_key_of_d')

        valueOfC.c_value.should.equal('Value of C - Non Localized')
        valueOfD.c_value.should.equal('Valor de D')

        result.orQueryUSLocale.length.should.equal(1)
        result.orQueryUSLocale[0].c_key.should.equal('c_key_of_c')

        result.orQueryESLocale.length.should.equal(2)

        valueOfC = _.find(result.orQueryESLocale, r => r.c_key === 'c_key_of_c')
        valueOfD = _.find(result.orQueryESLocale, r => r.c_key === 'c_key_of_d')

        valueOfC.c_value.should.equal('Value of C - Non Localized')
        valueOfD.c_value.should.equal('Valor de D')

        done()
      })
    })

    it('should query an $elemMatch correctly for similarly named documents and properties', (done) => {

      /* global org, consts */
      require('should')
      sandboxed(function() {
        const englishValueWithUSLocale = org.objects.c_ctxapi_167_subtypes.find({ 'c_document': {
                $elemMatch: {
                  $or: [
                    { 'c_value': 'Value of A - Document' },
                    { 'c_value': 'Valor de D - Documento' }
                  ]
                } } }).toArray(),
              spanishValueWithESLocale = org.objects.c_ctxapi_167_subtypes.find({ 'c_document': {
                $elemMatch: {
                  $or: [
                    { 'c_value': 'Value of A - Document' },
                    { 'c_value': 'Valor de D - Documento' }
                  ]
                } } }).locale('es_ES').toArray(),
              bothValuesWithUSLocale = org.objects.c_ctxapi_167_subtypes.find({ 'c_document': {
                $elemMatch: {
                  $or: [
                    { 'c_value': 'Value of A - Document' },
                    { 'c_value': 'Value of D - Document' }
                  ]
                } } }).toArray(),
              bothValuesWithESLocale = org.objects.c_ctxapi_167_subtypes.find({ 'c_document': {
                $elemMatch: {
                  $or: [
                    { 'c_value': 'Valor de A - Documento' },
                    { 'c_value': 'Valor de D - Documento' }
                  ]
                } } }).locale('es_ES').toArray()
        return { englishValueWithUSLocale,
          spanishValueWithESLocale,
          bothValuesWithUSLocale,
          bothValuesWithESLocale }
      })((err, result) => {
        if (err) done(err)

        result.englishValueWithUSLocale.length.should.equal(1)
        result.spanishValueWithESLocale.length.should.equal(1)
        result.bothValuesWithUSLocale.length.should.equal(2)
        result.bothValuesWithESLocale.length.should.equal(2)

        result.englishValueWithUSLocale[0].c_key.should.equal('c_key_of_a')
        result.englishValueWithUSLocale[0].c_document.c_value.should.equal('Value of A - Document')
        result.spanishValueWithESLocale[0].c_key.should.equal('c_key_of_d')
        result.spanishValueWithESLocale[0].c_document.c_value.should.equal('Valor de D - Documento')

        const englishValueOfA = _.find(result.bothValuesWithUSLocale, v => v.c_key === 'c_key_of_a'),
              englishValueOfD = _.find(result.bothValuesWithUSLocale, v => v.c_key === 'c_key_of_d'),

              spanishValueOfA = _.find(result.bothValuesWithESLocale, v => v.c_key === 'c_key_of_a'),
              spanishValueOfD = _.find(result.bothValuesWithESLocale, v => v.c_key === 'c_key_of_d')

        englishValueOfA.c_value.should.equal('Value of A')
        englishValueOfA.c_document.c_value.should.equal('Value of A - Document')
        englishValueOfD.c_value.should.equal('Value of D')
        englishValueOfD.c_document.c_value.should.equal('Value of D - Document')

        spanishValueOfA.c_value.should.equal('Valor de A')
        spanishValueOfA.c_document.c_value.should.equal('Valor de A - Documento')
        spanishValueOfD.c_value.should.equal('Valor de D')
        spanishValueOfD.c_document.c_value.should.equal('Valor de D - Documento')

        done()
      })
    })

    it('should throw kUnsupportedOperation when mixing localizable and non-localizable properties on $elemMatch query', sandboxed(function() {
      /* global org, consts */
      require('should')
      const tryCatch = require('util.values').tryCatch
      tryCatch(function() {
        return org.objects.c_ctxapi_167.find({
          'c_country_info': {
            $elemMatch: {
              'c_population': 1,
              'c_main_language': 'English'
            }
          }
        }).passthru()
      }, function(err) {
        err.errCode.should.equal('cortex.invalidArgument.query')
        err.path.should.equal('c_country_info.$elemMatch')
      })
    }))

    it('query with $elemMatch combined $or, $and', (done) => {
      require('should')
      sandboxed(function() {
        const single = org.objects.c_ctxapi_167.find({
                $and: [{
                  c_country_info: {
                    $elemMatch: {
                      $or: [
                        { 'c_main_language': 'English' },
                        { 'c_main_language': 'Italian' }
                      ]
                    }
                  }
                }, {
                  c_regions: {
                    $elemMatch: {
                      $and: [
                        { 'c_region_sections': { $in: ['section A', 'section ABC'] } },
                        { 'c_region_name': 'South' }
                      ]
                    }
                  }
                }
                ] }).toArray(),
              singleOtherLocaleNotFound = org.objects.c_ctxapi_167.find({
                $and: [{
                  c_country_info: {
                    $elemMatch: {
                      $or: [
                        { 'c_main_language': 'English' },
                        { 'c_main_language': 'Italian' }
                      ]
                    }
                  }
                }, {
                  c_regions: {
                    $elemMatch: {
                      $and: [
                        { 'c_region_sections': { $in: ['section A', 'section ABC'] } },
                        { 'c_region_name': 'South' }
                      ]
                    }
                  }
                }
                ] }).locale('es_ES').count(),
              singleOtherLocaleFound = org.objects.c_ctxapi_167.find({
                $and: [{
                  c_country_info: {
                    $elemMatch: {
                      $or: [
                        { 'c_main_language': 'Ingles' },
                        { 'c_main_language': 'Italiano' }
                      ]
                    }
                  }
                }, {
                  c_regions: {
                    $elemMatch: {
                      $and: [
                        { 'c_region_sections': { $in: ['seccion A', 'seccion ABC'] } },
                        { 'c_region_name': 'Sur' }
                      ]
                    }
                  }
                }
                ] }).locale('es_ES').toArray()
        return { single, singleOtherLocaleNotFound, singleOtherLocaleFound }
      })((err, result) => {
        if (err) return done(err)
        result.single.length.should.equal(1)

        var usa = _.find(result.single, country => country.c_key === 'c_us')

        usa.c_country_name.should.equal('United States')
        usa.c_country_info.c_main_language.should.equal('English')

        result.singleOtherLocaleNotFound.should.equal(0)

        result.singleOtherLocaleFound.length.should.equal(1)

        usa = _.find(result.singleOtherLocaleFound, country => country.c_key === 'c_us')

        usa.c_country_name.should.equal('Estados Unidos')
        usa.c_country_info.c_main_language.should.equal('Ingles')

        done()
      })
    })
  })

})
