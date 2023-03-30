const should = require('should'),
      _ = require('underscore'),
      server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      modules = require('../../../../lib/modules'),
      { promised } = require('../../../../lib/utils'),
      { AccessContext } = require('../../../../lib/acl'),
      { waitForWorker } = require('../../../lib/utils')()

describe('i18n Universal', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      return global.org.objects.i18n.insertMany([
        {
          locale: 'en_GB',
          namespace: 'app10',
          assets: [{
            key: 'com.medable.my_asset_file',
            value: {
              content: {
                source: 'buffer',
                buffer: 'my_asset_file'
              }
            }
          }],
          name: 'test__en_GB_app10',
          data: {
            com: {
              medable: {
                my_string_app: 'app10 my string'
              }
            }
          }
        },
        {
          locale: 'en_GB',
          namespace: 'app11',
          name: 'test__en_GB_app11',
          data: {
            com: {
              medable: {
                my_string_app: 'app11 my string'
              }
            }
          }
        },
        {
          locale: 'en_GB',
          namespace: 'app12',
          name: 'test__en_GB_app12',
          overridable: false,
          data: {
            com: {
              medable: {
                my_string_app: 'app12 my string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app10',
          extends: ['en_GB'],
          name: 'test__en_CA_app10',
          data: {
            com: {
              medable: {
                my_other_string: 'app10 string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app11',
          extends: ['en_GB'],
          name: 'test__en_CA_app11',
          data: {
            com: {
              medable: {
                my_other_string: 'app11 string'
              }
            }
          }
        },
        {
          locale: 'en_CA',
          namespace: 'app12',
          name: 'test__en_CA_app12',
          extends: ['en_GB'],
          data: {
            com: {
              medable: {
                my_other_string: 'app12 string'
              }
            }
          }
        },
        {
          locale: 'es_US',
          namespace: 'app10',
          name: 'test__es_US_app10',
          data: {
            com: {
              medable: {
                my_string: 'app10 texto'
              }
            }
          }
        },
        {
          locale: 'es_US',
          namespace: 'app11',
          name: 'test__es_US_app11',
          data: {
            com: {
              medable: {
                my_string: 'app11 texto'
              }
            }
          }
        },
        {
          locale: 'es_US',
          namespace: 'app12',
          name: 'test__es_US_app12',
          data: {
            com: {
              medable: {
                my_string: 'app12 texto'
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()
    }))
  })

  afterEach(async() => {
    await waitForWorker(server, 'instance-reaper', () => promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
    })), { forceWorkerRun: true })
  })

  after(async() => {
    await waitForWorker(server, 'instance-reaper', () => promised(null, sandboxed(function() {
      const action1 = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute(),
            action2 = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
      return [action1, action2]
    })), { forceWorkerRun: true })
  })

  it('should create bundle for single locale multiple namespaces', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          i18n = new modules.i18n()

    await i18n.buildBundles(ac, { locales: ['en_GB'], namespaces: ['app10', 'app11', 'app12'] })
    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
            return global.org.objects.i18nbundle.find({ locale: { $in: ['en_GB'] }, namespace: { $in: ['app10', 'app11', 'app12'] } }).skipAcl().grant(4).toArray()
          })),
          data = _.sortBy(result.map(r => ({ locale: r.locale, namespace: r.namespace })), 'namespace')

    should.equal(data.length, 3)

    let resultlocaleNamespaceList = result.map(current => {
          return [current.locale, current.namespace].join()
        }),

        expectedlocaleNamespacesList = [
          ['en_GB', 'app10'],
          ['en_GB', 'app11'],
          ['en_GB', 'app12']
        ].map(current => {
          return current.join()
        }),

        differingLocaleNamespace = resultlocaleNamespaceList.filter(current => {
          return (_.indexOf(expectedlocaleNamespacesList, current) < 0)
        })
    should.equal(differingLocaleNamespace.length, 0)
  })

  it('should create bundle for single locale single namespaces', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          i18n = new modules.i18n()

    await i18n.buildBundles(ac, { locales: ['en_GB'], namespaces: ['app10'] })

    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.find({ locale: 'en_GB', namespace: 'app10' }).skipAcl().grant(4).toArray()
    }))
    should.equal(result.length, 1)
    should.equal(result[0].locale, 'en_GB')
    should.equal(result[0].namespace, 'app10')
  })

  it('should create bundle for multiple locale multiple namespaces', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          i18n = new modules.i18n()

    await i18n.buildBundles(ac, { locales: ['en_GB', 'es_US'], namespaces: ['app10', 'app11'] })

    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
            return global.org.objects.i18nbundle.find({ locale: { $in: ['en_GB', 'es_US'] }, namespace: { $in: ['app10', 'app11'] } }).skipAcl().grant(4).toArray()
          })),
          data = _.sortBy(result.map(r => ({ locale: r.locale, namespace: r.namespace })), 'namespace')
    should.equal(data.length, 4)

    let resultlocaleNamespaceList = result.map(current => {
          return [current.locale, current.namespace].join()
        }),

        expectedlocaleNamespacesList = [
          ['es_US', 'app10'],
          ['es_US', 'app11'],
          ['en_GB', 'app10'],
          ['en_GB', 'app11']
        ].map(current => {
          return current.join()
        }),

        differingLocaleNamespace = resultlocaleNamespaceList.filter(current => {
          return (_.indexOf(expectedlocaleNamespacesList, current) < 0)
        })
    should.equal(differingLocaleNamespace.length, 0)
  })

  it('should create bundle for multiple locale single namespaces', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          i18n = new modules.i18n()

    await i18n.buildBundles(ac, { locales: ['en_GB', 'es_US'], namespaces: ['app10'] })

    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.find({ locale: { $in: ['en_GB', 'es_US'] }, namespace: 'app10' }).skipAcl().grant(4).toArray()
    }))
    should.equal(result.length, 2)

    let resultlocaleNamespaceList = result.map(current => {
      return [current.locale, current.namespace]
    })

    should.deepEqual(resultlocaleNamespaceList, [['en_GB', 'app10'], ['es_US', 'app10']])

  })

  it('should create bundle for all locales/namespaces', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          i18n = new modules.i18n()
    await i18n.buildBundles(ac)
    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.find().skipAcl().grant(4).toArray()
    }))

    should.equal(result.length, 9)

    let resultlocaleNamespaceList = result.map(current => {
          return [current.locale, current.namespace]
        }),

        expectedlocaleNamespacesList = [
          ['en_CA', 'app10'],
          ['en_CA', 'app11'],
          ['en_CA', 'app12'],
          ['es_US', 'app10'],
          ['es_US', 'app11'],
          ['es_US', 'app12'],
          ['en_GB', 'app10'],
          ['en_GB', 'app11'],
          ['en_GB', 'app12']
        ]

    should.deepEqual(resultlocaleNamespaceList.sort(), expectedlocaleNamespacesList.sort())
  })

  it('should create a bundle for each locale with all namespaces when onePerNs is false', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          i18n = new modules.i18n()
    await i18n.buildBundles(ac, { onePerNs: false })

    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.find().skipAcl().grant(4).toArray()
    }))
    should.equal(result.length, 3)

    let resultsData = result.map(r => _.pick(r, 'object', 'locale', 'data', 'namespace'))

    const expected = [
      {
        object: 'i18nbundle',
        locale: 'en_GB',
        data: {
          app11: {
            com: {
              medable: {
                my_string_app: 'app11 my string'
              }
            }
          },
          app12: {
            com: {
              medable: {
                my_string_app: 'app12 my string'
              }
            }
          },
          app10: {
            com: {
              medable: {
                my_string_app: 'app10 my string'
              }
            }
          }
        },
        namespace: null
      },
      {
        object: 'i18nbundle',
        locale: 'es_US',
        data: {
          app10: {
            com: {
              medable: {
                my_string: 'app10 texto'
              }
            }
          },
          app11: {
            com: {
              medable: {
                my_string: 'app11 texto'
              }
            }
          },
          app12: {
            com: {
              medable: {
                my_string: 'app12 texto'
              }
            }
          }
        },
        namespace: null
      },
      {
        object: 'i18nbundle',
        locale: 'en_CA',
        data: {
          app10: {
            com: {
              medable: {
                my_string_app: 'app10 my string',
                my_other_string: 'app10 string'
              }
            }
          },
          app11: {
            com: {
              medable: {
                my_string_app: 'app11 my string',
                my_other_string: 'app11 string'
              }
            }
          },
          app12: {
            com: {
              medable: {
                my_string_app: 'app12 my string',
                my_other_string: 'app12 string'
              }
            }
          }
        },
        namespace: null
      }
    ]
    resultsData.sort((a, b) => a.locale.localeCompare(b.locale)).should.containDeep(expected.sort((a, b) => a.locale.localeCompare(b.locale)))

  })

  it('should ignore locale for bundle if not exists', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          i18n = new modules.i18n()

    await i18n.buildBundles(ac, { locales: ['es_MX', 'en_GB'] })

    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
            return global.org.objects.i18nbundle.find({ locale: { $in: ['es_MX', 'en_GB'] } }).skipAcl().grant(4).toArray()
          })),
          data = _.sortBy(result.map(r => ({ locale: r.locale, namespace: r.namespace })), 'namespace')

    should.equal(data.length, 3)

    let resultlocaleNamespaceList = result.map(current => {
          return [current.locale, current.namespace].join()
        }),

        expectedlocaleNamespacesList = [
          ['en_GB', 'app10'],
          ['en_GB', 'app11'],
          ['en_GB', 'app12']
        ].map(current => {
          return current.join()
        }),

        differingLocaleNamespace = resultlocaleNamespaceList.filter(current => {
          return (_.indexOf(expectedlocaleNamespacesList, current) < 0)
        })
    should.equal(differingLocaleNamespace.length, 0)
  })

  it('should update bundle for single locale single namespaces', async() => {
    const { principals: { admin } } = server,
      ac = new AccessContext(admin),
      i18n = new modules.i18n()

    // first build 
    await i18n.buildBundles(ac, { locales: ['en_GB'], namespaces: ['app11'] })

    // eslint-disable-next-line one-var
    const initialResult = await promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.find({locale: 'en_GB', namespace: 'app11'}).skipAcl().grant(4).toArray()
    }))

    should.equal(initialResult.length, 1)

    let initialResultData = initialResult.map(r => _.pick(r, 'object', 'locale', 'data', 'namespace'))

    // check that this is what was initialized in the before hook
    should.equal('app11 my string', initialResultData[0].data.com.medable.my_string_app)

    // now update the i18n object on the database 
    await promised(null, sandboxed(function() {
      global.org.objects.i18n.updateOne({ name: 'test__en_GB_app11' }, {
        $set: {
          data: {
            com: {
              medable: {
                my_string_app: 'app11 my string updated!!'
              }
            }
          }
        }
      }).skipAcl().grant(8).execute()
    }))

    // build the bundle again
    await i18n.buildBundles(ac, { locales: ['en_GB'], namespaces: ['app11'] })

    // eslint-disable-next-line one-var
    const result = await promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.find({locale: 'en_GB', namespace: 'app11'}).skipAcl().grant(4).toArray()
    }))

    should.equal(result.length, 1)

    let resultData = result.map(r => _.pick(r, 'object', 'locale', 'data', 'namespace'))

    // check that the data has been updated
    should.equal('app11 my string updated!!', resultData[0].data.com.medable.my_string_app)
  })

  it('should update bundle for multiple locales/namespaces including extensions', async() => {
    const { principals: { admin } } = server,
      ac = new AccessContext(admin),
      i18n = new modules.i18n()

    // first build 
    await i18n.buildBundles(ac, { locales: ['es_US','en_CA'], namespaces: ['app11', 'app10'] })

    // now update the i18n object on the database 
    await promised(null, sandboxed(function() {
      // update the base locale
      global.org.objects.i18n.updateOne({ name: 'test__es_US_app10' }, {
        $set: {
          data: {
            com: {
              medable: {
                my_string_app: 'app10 my string updated!!'
              }
            }
          }
        }
      }).skipAcl().grant(8).execute()

      // update the base locale
      global.org.objects.i18n.updateOne({ name: 'test__es_US_app11' }, {
        $set: {
          data: {
            com: {
              medable: {
                my_string_app: 'app11 my string updated!!'
              }
            }
          }
        }
      }).skipAcl().grant(8).execute()

      // update the extended locale
      global.org.objects.i18n.updateOne({ name: 'test__en_CA_app11' }, { 
        $set: {
          data: {
            com: {
              medable: {
                my_other_string: 'en_CA app11 my string updated!!'
              }
            }
          }
        }
      }).skipAcl().grant(8).execute()
    }))

    // build the bundle again
    await i18n.buildBundles(ac, { locales: ['es_US','en_CA'], namespaces: ['app11', 'app10'] })

    const result = await promised(null, sandboxed(function() {
      return global.org.objects.i18nbundle.find({locale: { $in: ['es_US','en_CA'] }, namespace: { $in: ['app11', 'app10'] }}).skipAcl().grant(4).toArray()
    }))

    should.equal(result.length, 4)

    let resultData = result.map(r => _.pick(r, 'object', 'locale', 'data', 'namespace'))

    console.log('resultData', JSON.stringify(resultData, null, 2))

    let enCa11bundle = resultData.find(current => current.locale == 'en_CA' && current.namespace == 'app11')
    let enCa10bundle = resultData.find(current => current.locale == 'en_CA' && current.namespace == 'app10')

    // check that extended locales are also updated 
    should.equal("app10 string", enCa10bundle.data.com.medable.my_other_string)
    should.equal("en_CA app11 my string updated!!", enCa11bundle.data.com.medable.my_other_string)
  })

  it('should remove bundles of non existing i18n locales to back it up', async() => {
    const resultA = await promised(null, sandboxed(function() {
            global.org.objects.i18n.insertOne({
              locale: 'es_MX',
              namespace: 'app_test_mx',
              name: 'test__es_MX_app_test_mx',
              data: {
                com: {
                  medable: {
                    my_brand_new_key: 'Hola desde Mexico.'
                  }
                }
              }
            }).execute()

            const i18n = require('i18n')
            return i18n.buildBundles()
          })),
          resultB = await promised(null, sandboxed(function() {
            global.org.objects.i18n.deleteOne({
              name: 'test__es_MX_app_test_mx'
            }).execute()

            const i18n = require('i18n')
            return i18n.buildBundles()
          }))

    should.equal(resultA.length, 10)
    should.equal(resultB.length, 9)
  })

})
