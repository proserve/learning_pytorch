const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Features - CTXAPI-458 Localized Objects', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org, consts */
      org.objects.objects.insertOne({
        label: 'CTXAPI-458-Source',
        name: 'c_ctxapi_458_source',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public']
      }).execute()

      org.objects.objects.insertOne({
        label: 'CTXAPI-458-EN',
        name: 'c_ctxapi_458',
        description: 'CTXAPI-458 description',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          {
            label: 'String Prop',
            name: 'c_string_label',
            type: 'String'
          }, {
            label: 'Any Prop',
            name: 'c_any_label',
            type: 'Any'
          }, {
            label: 'Bool Prop',
            name: 'c_bool_label',
            type: 'Boolean'
          }, {
            label: 'Date Prop',
            name: 'c_date_label',
            type: 'Date'
          }, {
            label: 'Document Prop',
            name: 'c_document_label',
            type: 'Document',
            properties: [{
              label: 'Sub String Prop',
              name: 'c_sub_string_label',
              type: 'String'
            }]
          }, {
            label: 'Geometry Prop',
            name: 'c_geo_label',
            type: 'Geometry'
          }, {
            label: 'List Prop',
            name: 'c_list_label',
            type: 'List',
            sourceObject: 'c_ctxapi_458_source'
          }, {
            label: 'Number Prop',
            name: 'c_number_label',
            type: 'Number'
          }, {
            label: 'ObjectId Prop',
            name: 'c_objectid_label',
            type: 'ObjectId'
          }, {
            label: 'Reference Prop',
            name: 'c_reference_label',
            type: 'Reference',
            sourceObject: 'c_ctxapi_458_source'
          }, {
            label: 'Set Prop',
            name: 'c_set_label',
            type: 'Set'
          }, {
            label: 'Binary Prop',
            name: 'c_binary_label',
            type: 'Binary'
          }, {
            label: 'UUID Prop',
            name: 'c_uuid_label',
            type: 'UUID'
          }],
        objectTypes: [
          { label: 'Type A',
            name: 'c_type_a',
            properties: [
              { label: 'Type A Prop', name: 'c_type_a', type: 'String' } // this will be indexed.
            ]
          },
          { label: 'Type B',
            name: 'c_type_b',
            properties: [
              { label: 'Type B Prop', name: 'c_type_a', type: 'Number' }
            ]
          }
        ],
        localized: true
      }).locale('en_US').execute()

      org.objects.objects.updateOne({ name: 'c_ctxapi_458' }, {
        $set: {
          label: 'CTXAPI-458-ES',
          description: 'CTXAPI-458 descripcion',
          properties: [
            {
              name: 'c_string_label',
              label: 'Prop Texto'
            }, {
              name: 'c_any_label',
              label: 'Prop Cualquiera'
            }, {
              name: 'c_bool_label',
              label: 'Prop Boleana'
            }, {
              name: 'c_date_label',
              label: 'Prop Fecha'
            }, {
              name: 'c_date_label',
              label: 'Prop Fecha'
            }, {
              label: 'Prop Documento',
              name: 'c_document_label',
              properties: [{
                label: 'Prop Sub Texto',
                name: 'c_sub_string_label'
              }]
            }, {
              label: 'Prop Geometria',
              name: 'c_geo_label'
            }, {
              label: 'Prop Lista',
              name: 'c_list_label'
            }, {
              label: 'Prop Numero',
              name: 'c_number_label'
            }, {
              label: 'Prop Id Objeto',
              name: 'c_objectid_label'
            }, {
              label: 'Prop Referencia',
              name: 'c_reference_label'
            }, {
              label: 'Prop Set',
              name: 'c_set_label'
            }, {
              label: 'Prop Binaria',
              name: 'c_binary_label'
            }, {
              label: 'Prop ID Unico',
              name: 'c_uuid_label'
            }],
          objectTypes: [
            { label: 'Tipo A',
              name: 'c_type_a',
              properties: [
                { label: 'Tipo Prop A', name: 'c_type_a', type: 'String' }
              ]
            },
            { label: 'Tipo B',
              name: 'c_type_b',
              properties: [
                { label: 'Tipo Prop B', name: 'c_type_a', type: 'Number' }
              ]
            }
          ]
        }
      }).locale('es_AR').execute()

    }))
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      org.objects.objects.deleteOne({ name: 'c_ctxapi_458' }).execute()
      org.objects.objects.deleteOne({ name: 'c_ctxapi_458_source' }).execute()
    }))
  })

  it('check all translations are returned properly', async() => {
    const result = await promised(null, sandboxed(function() {
            // eslint-disable-next-line camelcase
            const en_US = org.objects.objects.find({ name: 'c_ctxapi_458' }).paths('label', 'description', 'properties', 'objectTypes').locale('en_US').next(),
                  // eslint-disable-next-line camelcase
                  es_AR = org.objects.objects.find({ name: 'c_ctxapi_458' }).paths('label', 'description', 'properties', 'objectTypes').locale('es_AR').next(),
                  locales = org.objects.objects.find({ name: 'c_ctxapi_458' }).include('locales').paths('locales').next()
            return { en_US, es_AR, locales }
          })),
          mapProps = (props) => {
            return props.map(p => {
              const item = {
                label: p.label,
                name: p.name
              }
              if (p.properties) {
                item.properties = mapProps(p.properties)
              }
              return item
            })
          }

    should.equal(result.en_US.label, 'CTXAPI-458-EN')
    should.equal(result.es_AR.label, 'CTXAPI-458-ES')
    should.equal(result.en_US.description, 'CTXAPI-458 description')
    should.equal(result.es_AR.description, 'CTXAPI-458 descripcion')
    // check properties
    should.deepEqual(mapProps(result.en_US.properties), [
      {
        'label': 'String Prop',
        'name': 'c_string_label'
      },
      {
        'label': 'Any Prop',
        'name': 'c_any_label'
      },
      {
        'label': 'Bool Prop',
        'name': 'c_bool_label'
      },
      {
        'label': 'Date Prop',
        'name': 'c_date_label'
      },
      {
        'label': 'Document Prop',
        'name': 'c_document_label',
        'properties': [{
          'label': 'Sub String Prop',
          'name': 'c_sub_string_label'
        }]
      },
      {
        'label': 'Geometry Prop',
        'name': 'c_geo_label'
      },
      {
        'label': 'List Prop',
        'name': 'c_list_label'
      },
      {
        'label': 'Number Prop',
        'name': 'c_number_label'
      },
      {
        'label': 'ObjectId Prop',
        'name': 'c_objectid_label'
      },
      {
        'label': 'Reference Prop',
        'name': 'c_reference_label'
      },
      {
        'label': 'Set Prop',
        'name': 'c_set_label'
      },
      {
        'label': 'Binary Prop',
        'name': 'c_binary_label'
      },
      {
        'label': 'UUID Prop',
        'name': 'c_uuid_label'
      }
    ])
    should.deepEqual(mapProps(result.en_US.objectTypes), [
      { label: 'Type A',
        name: 'c_type_a',
        properties: [
          { label: 'Type A Prop', name: 'c_type_a' } // this will be indexed.
        ]
      },
      { label: 'Type B',
        name: 'c_type_b',
        properties: [
          { label: 'Type B Prop', name: 'c_type_a' }
        ]
      }
    ])
    should.deepEqual(mapProps(result.es_AR.properties), [
      {
        'label': 'Prop Texto',
        'name': 'c_string_label'
      },
      {
        'label': 'Prop Cualquiera',
        'name': 'c_any_label'
      },
      {
        'label': 'Prop Boleana',
        'name': 'c_bool_label'
      },
      {
        'label': 'Prop Fecha',
        'name': 'c_date_label'
      },
      {
        'label': 'Prop Documento',
        'name': 'c_document_label',
        'properties': [{
          'label': 'Prop Sub Texto',
          'name': 'c_sub_string_label'
        }]
      },
      {
        'label': 'Prop Geometria',
        'name': 'c_geo_label'
      },
      {
        'label': 'Prop Lista',
        'name': 'c_list_label'
      },
      {
        'label': 'Prop Numero',
        'name': 'c_number_label'
      },
      {
        'label': 'Prop Id Objeto',
        'name': 'c_objectid_label'
      },
      {
        'label': 'Prop Referencia',
        'name': 'c_reference_label'
      },
      {
        'label': 'Prop Set',
        'name': 'c_set_label'
      },
      {
        'label': 'Prop Binaria',
        'name': 'c_binary_label'
      },
      {
        'label': 'Prop ID Unico',
        'name': 'c_uuid_label'
      }
    ])
    should.deepEqual(mapProps(result.es_AR.objectTypes), [
      { label: 'Tipo A',
        name: 'c_type_a',
        properties: [
          { label: 'Tipo Prop A', name: 'c_type_a' }
        ]
      },
      { label: 'Tipo B',
        name: 'c_type_b',
        properties: [
          { label: 'Tipo Prop B', name: 'c_type_a' }
        ]
      }
    ])

  })

})
