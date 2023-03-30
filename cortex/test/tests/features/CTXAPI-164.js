'use strict'

/* global before */

const sandboxed = require('../../lib/sandboxed'),
      config = require('cortex-service/lib/config'),
      defaultLocale = config('locale.defaultLocale') || process.env.LANG || 'en_US'

describe('Features - Localization', function() {

  describe('CTXAPI-164', function() {

    before(sandboxed(function() {

      org.objects.script.insertOne({
        label: 'CTXAPI-164 Library',
        type: 'library',
        script: `

          module.exports = {

            defaultAttributes() {
              return getDefaultAttributes()
            },

            resetAttributes() {
              setAttributes(
                getDefaultAttributes()
              )
            },

            setAttributes(attributes = {}) {

              let defaults = getDefaultAttributes()

              attributes = {
                ...defaults,
                ...attributes,
                localization: {
                  ...defaults.localization,
                  ...attributes.localization
                }
              }

              setAttributes(
                attributes
              )

            }

          }

          function getDefaultAttributes() {

            return {
              indexed: true,
              removable: true,
              localization: {
                enabled: true,
                strict: false,
                fallback: true,
                acl: [],
                fixed: '',
                valid: []
              }
            }

          }

          function setAttributes(attributes) {

            org.objects.objects.updateOne({
                name: 'c_ctxapi_164'
              }, {
                $set: {
                  properties: [{
                    name: 'c_string', ...attributes
                  }, {
                    name: 'c_strings', ...attributes
                  }, {
                    name: 'c_doc',
                    properties: [{
                      name: 'c_string', ...attributes
                    }, {
                      name: 'c_strings', ...attributes
                    }]
                  }, {
                    name: 'c_docs',
                    properties: [{
                      name: 'c_string', ...attributes
                    }, {
                      name: 'c_strings', ...attributes
                    }]
                  }]
                }
             }).passive().execute()

          }
        `,
        configuration: {
          export: 'c_ctxapi_164'
        }
      }).execute()

    }))

    before(sandboxed(function() {

      const { defaultAttributes } = require('c_ctxapi_164'),
            attributes = defaultAttributes()

      org.objects.objects.insertOne({
        label: 'CTXAPI-164',
        name: 'c_ctxapi_164',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [{
          name: 'c_string',
          label: 'String',
          type: 'String',
          ...attributes
        }, {
          name: 'c_strings',
          label: 'Strings',
          type: 'String',
          array: true,
          ...attributes
        }, {
          name: 'c_doc',
          label: 'Doc',
          type: 'Document',
          properties: [{
            name: 'c_string',
            label: 'String',
            type: 'String',
            ...attributes
          }, {
            name: 'c_strings',
            label: 'Strings',
            type: 'String',
            array: true,
            ...attributes
          }]
        }, {
          name: 'c_docs',
          label: 'Docs',
          type: 'Document',
          array: true,
          uniqueKey: 'c_key',
          properties: [{
            name: 'c_key',
            label: 'Key',
            type: 'String',
            validators: [{ name: 'customName' }, { name: 'uniqueInArray' }]
          }, {
            name: 'c_string',
            label: 'String',
            type: 'String',
            ...attributes
          }, {
            name: 'c_strings',
            label: 'Strings',
            type: 'String',
            array: true,
            ...attributes
          }]
        }]
      }).execute()

    }))

    it('set and unset of virtual string', sandboxed(function() {

      /* global org, consts, script */

      script.locale = 'en_GB'

      let doc, _id

      const { resetAttributes, setAttributes } = require('c_ctxapi_164'),
            { equalIds } = require('util.id'),
            { arguments: { defaultLocale } } = script,
            should = require('should'),
            load = (locale = script.locale) => {
              return org.objects.c_ctxapi_164
                .find({ _id })
                .include('locales')
                .locale(locale)
                .next()
            }

      resetAttributes()

      _id = org.objects.c_ctxapi_164.insertOne({
        c_string: 'en_US',
        c_strings: ['en_US', 'en_US', 'en_US', 'english us'],
        c_doc: {
          c_string: 'en_US',
          c_strings: ['en_US', 'en_US', 'en_US', 'english us']
        },
        c_docs: [{
          c_key: 'c_one',
          c_string: 'en_US one',
          c_strings: ['en_US', 'en_US', 'en_US', 'english us one']
        }, {
          c_key: 'c_two',
          c_string: 'en_US two',
          c_strings: ['en_US', 'en_US', 'en_US', 'english us two']
        }]
      }).locale('en_US').execute()

      org.objects.c_ctxapi_164.updateOne({
        _id
      }, {
        $set: {
          c_string: 'en_GB',
          c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb'],
          c_doc: {
            c_string: 'en_GB',
            c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb']
          },
          c_docs: [{
            c_key: 'c_one',
            c_string: 'en_GB one',
            c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb one']
          }, {
            c_key: 'c_two',
            c_string: 'en_GB two',
            c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb two']
          }]
        }
      }).execute()

      doc = load()

      doc.c_string.should.equal('en_GB')
      doc.c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb'])
      doc.c_doc.c_string.should.equal('en_GB')
      doc.c_doc.c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb'])
      doc.c_docs.find(v => v.c_key === 'c_one').c_string.should.equal('en_GB one')
      doc.c_docs.find(v => v.c_key === 'c_one').c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb one'])
      doc.c_docs.find(v => v.c_key === 'c_two').c_string.should.equal('en_GB two')
      doc.c_docs.find(v => v.c_key === 'c_two').c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb two'])
      doc.locales.c_string.length.should.equal(2)
      doc.locales.c_strings.length.should.equal(2)
      doc.locales.c_doc.c_string.length.should.equal(2)
      doc.locales.c_doc.c_strings.length.should.equal(2)

      doc.locales.c_docs.find(v => v.c_key === 'c_one').c_string.length.should.equal(2)
      doc.locales.c_docs.find(v => v.c_key === 'c_one').c_strings.length.should.equal(2)
      doc.locales.c_docs.find(v => v.c_key === 'c_two').c_string.length.should.equal(2)
      doc.locales.c_docs.find(v => v.c_key === 'c_two').c_strings.length.should.equal(2)

      should(equalIds(doc.locales.c_docs.find(v => v.c_key === 'c_one')._id, doc.c_docs.find(v => v.c_key === 'c_one')._id)).be.true()
      should(equalIds(doc.locales.c_docs.find(v => v.c_key === 'c_two')._id, doc.c_docs.find(v => v.c_key === 'c_two')._id)).be.true()

      org.objects.c_ctxapi_164.find({ _id }).paths('c_string').locale('en_US').next().c_string.should.equal('en_US')
      org.objects.c_ctxapi_164.find({ _id }).paths('c_strings').locale('en_US').next().c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us'])
      org.objects.c_ctxapi_164.find({ _id }).paths('c_doc.c_string').locale('en_US').next().c_doc.c_string.should.equal('en_US')
      org.objects.c_ctxapi_164.find({ _id }).paths('c_doc.c_strings').locale('en_US').next().c_doc.c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us'])
      org.objects.c_ctxapi_164.find({ _id }).paths('c_docs').locale('en_US').next().c_docs.find(v => v.c_key === 'c_one').c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us one'])
      org.objects.c_ctxapi_164.find({ _id }).paths('c_docs').locale('en_US').next().c_docs.find(v => v.c_key === 'c_two').c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us two'])

      // -----------------------------------------------------------------------------

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $unset: {
          c_string: true,
          c_strings: true,
          'c_doc.c_string': true,
          'c_doc.c_strings': true,
          'c_docs.c_one.c_string': true,
          'c_docs.c_one.c_strings': true
        }
      }).execute()

      doc = load()
      doc.locales.c_string.length.should.equal(1)
      doc.locales.c_strings.length.should.equal(1)
      doc.locales.c_doc.c_string.length.should.equal(1)
      doc.locales.c_doc.c_strings.length.should.equal(1)
      doc.c_string.should.equal('en_US')
      doc.c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us'])
      doc.c_doc.c_string.should.equal('en_US')
      doc.c_doc.c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us'])
      doc.c_docs.find(v => v.c_key === 'c_one').c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us one'])

      setAttributes({ localization: { fallback: false } })

      doc = load()
      Boolean(doc.c_string === undefined).should.equal(true)
      doc.c_strings.should.deepEqual([])
      Boolean(doc.c_doc.c_string === undefined).should.equal(true)
      doc.c_doc.c_strings.should.deepEqual([])
      doc.c_docs.find(v => v.c_key === 'c_one').c_strings.should.deepEqual([])

      // reset some documents
      // this will have the default locale inserted automatically.
      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $set: {
          c_docs: [{
            c_key: 'c_three',
            c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb three']
          }]
        }
      }).execute()

      doc = load()
      doc.c_docs.find(v => v.c_key === 'c_three').c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb three'])
      doc.locales.c_docs.length.should.equal(1)
      doc.locales.c_docs.find(v => v.c_key === 'c_three').c_strings.length.should.equal(2)
      should.exist(doc.locales.c_docs.find(v => v.c_key === 'c_three').c_strings.find(v => v.locale === defaultLocale))
      should.exist(doc.locales.c_docs.find(v => v.c_key === 'c_three').c_strings.find(v => v.locale === script.locale))
      should(equalIds(doc.locales.c_docs.find(v => v.c_key === 'c_three')._id, doc.c_docs.find(v => v.c_key === 'c_three')._id)).be.true()

    }, {
      runtimeArguments: {
        defaultLocale
      }
    }))

    it('push and pull in virtual string', sandboxed(function() {

      /* global org, consts, script */

      require('should')

      script.locale = 'en_GB'

      let doc, _id

      const { resetAttributes } = require('c_ctxapi_164'),
            load = (locale = script.locale) => {
              return org.objects.c_ctxapi_164
                .find({ _id })
                .include('locales')
                .locale(locale)
                .next()
            }

      resetAttributes()

      _id = org.objects.c_ctxapi_164.insertOne({
        c_strings: ['en_US', 'en_US', 'en_US', 'english us'],
        c_doc: {
          c_strings: ['en_US', 'en_US', 'en_US', 'english us']
        },
        c_docs: [{
          c_key: 'c_one',
          c_strings: ['en_US', 'en_US', 'en_US', 'english us']
        }]
      }).locale('en_US').execute()

      org.objects.c_ctxapi_164.updateOne({
        _id
      }, {
        $set: {
          c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb'],
          c_doc: {
            c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb']
          },
          c_docs: [{
            c_key: 'c_one',
            c_strings: ['en_GB', 'en_GB', 'en_GB', 'english gb']
          }]
        }
      }).execute()

      doc = load('en_GB')
      doc.c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb'])
      doc.c_doc.c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb'])
      doc.c_docs[0].c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb'])

      doc.locales.c_strings.length.should.equal(2)
      doc.locales.c_doc.c_strings.length.should.equal(2)
      doc.locales.c_docs[0].c_strings.length.should.equal(2)

      doc = load('en_US')
      doc.c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us'])
      doc.c_doc.c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us'])
      doc.c_docs[0].c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us'])

      org.objects.c_ctxapi_164.updateOne({
        _id
      }, {
        $push: {
          c_strings: ['who', 'are', 'you'],
          c_doc: {
            c_strings: ['who', 'are', 'you']
          },
          c_docs: [{
            c_key: 'c_one',
            c_strings: ['who', 'are', 'you']
          }]
        }
      }).execute()

      org.objects.c_ctxapi_164.updateOne({
        _id
      }, {
        $push: {
          c_strings: ['u', 's', 'a'],
          c_doc: {
            c_strings: ['u', 's', 'a']
          },
          c_docs: [{
            c_key: 'c_one',
            c_strings: ['u', 's', 'a']
          }]
        }
      }).locale('en_US').execute()

      doc = load('en_GB')
      doc.c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb', 'who', 'are', 'you'])
      doc.c_doc.c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb', 'who', 'are', 'you'])
      doc.c_docs[0].c_strings.should.deepEqual(['en_GB', 'en_GB', 'en_GB', 'english gb', 'who', 'are', 'you'])

      doc = load('en_US')
      doc.c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us', 'u', 's', 'a'])
      doc.c_doc.c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us', 'u', 's', 'a'])
      doc.c_docs[0].c_strings.should.deepEqual(['en_US', 'en_US', 'en_US', 'english us', 'u', 's', 'a'])

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $pull: {
          c_strings: ['en_GB', 'are'],
          c_doc: {
            c_strings: ['en_GB', 'are']
          },
          'c_docs.c_one.c_strings': ['en_GB', 'are']
        }
      }).locale('en_GB').execute()

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $pull: {
          c_strings: ['en_US', 's'],
          c_doc: {
            c_strings: ['en_US', 's']
          },
          'c_docs.c_one.c_strings': ['en_US', 's']
        }
      }).locale('en_US').execute()

      doc = load('en_GB')
      doc.c_strings.should.deepEqual(['english gb', 'who', 'you'])
      doc.c_doc.c_strings.should.deepEqual(['english gb', 'who', 'you'])
      doc.c_docs[0].c_strings.should.deepEqual(['english gb', 'who', 'you'])

      doc = load('en_US')
      doc.c_strings.should.deepEqual(['english us', 'u', 'a'])
      doc.c_doc.c_strings.should.deepEqual(['english us', 'u', 'a'])
      doc.c_docs[0].c_strings.should.deepEqual(['english us', 'u', 'a'])

    }))

    it('locales document set and unset', sandboxed(function() {

      /* global org, consts, script */

      require('should')

      script.locale = 'en_GB'

      let doc, _id

      const { resetAttributes } = require('c_ctxapi_164'),
            load = (locale = script.locale) => {
              return org.objects.c_ctxapi_164
                .find({ _id })
                .include('locales')
                .locale(locale)
                .next()
            }

      resetAttributes()

      _id = org.objects.c_ctxapi_164.insertOne({
        c_docs: [{
          c_key: 'c_one'
        }],
        locales: {
          c_string: [{
            locale: 'en_US',
            value: 'en_US'
          }, {
            locale: 'en_GB',
            value: 'en_GB'
          }],
          c_strings: [{
            locale: 'en_US',
            value: ['en_US', 'english us']
          }, {
            locale: 'en_GB',
            value: ['en_GB', 'english gb']
          }],
          c_doc: {
            c_string: [{
              locale: 'en_US',
              value: 'en_US'
            }, {
              locale: 'en_GB',
              value: 'en_GB'
            }],
            c_strings: [{
              locale: 'en_US',
              value: ['en_US', 'english us']
            }, {
              locale: 'en_GB',
              value: ['en_GB', 'english gb']
            }]
          },
          c_docs: [{
            c_key: 'c_one',
            c_string: [{
              locale: 'en_US',
              value: 'en_US'
            }, {
              locale: 'en_GB',
              value: 'en_GB'
            }],
            c_strings: [{
              locale: 'en_US',
              value: ['en_US', 'english us']
            }, {
              locale: 'en_GB',
              value: ['en_GB', 'english gb']
            }]
          }]
        }
      }).execute()

      // test pushing another one with existing document.
      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $push: {
          c_docs: [{
            c_key: 'c_two'
          }]
        }
      }).execute()

      doc = load()

      doc.c_string.should.equal('en_GB')
      doc.c_strings.should.deepEqual(['en_GB', 'english gb'])
      doc.c_doc.c_string.should.equal('en_GB')
      doc.c_doc.c_strings.should.deepEqual(['en_GB', 'english gb'])
      doc.locales.c_string.length.should.equal(2)
      doc.locales.c_strings.length.should.equal(2)
      doc.locales.c_doc.c_string.length.should.equal(2)
      doc.locales.c_doc.c_strings.length.should.equal(2)
      doc.locales.c_docs.find(v => v.c_key === 'c_one').c_string.length.should.equal(2)
      doc.locales.c_docs.find(v => v.c_key === 'c_one').c_strings.length.should.equal(2)

      try {
        org.objects.c_ctxapi_164.updateOne({ _id }, {
          $unset: {
            'locales.c_docs.c_one': true
          }
        }).execute()
      } catch (err) {
        if (err.code !== 'kAccessDenied' || err.path !== 'c_ctxapi_164.locales.c_docs[]') {
          throw err
        }
      }

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $unset: {
          'locales.c_string': true,
          'locales.c_strings': true,
          'locales.c_doc.c_string': true,
          'locales.c_doc.c_strings': true,
          'locales.c_docs.c_one.c_string': true,
          'locales.c_docs.c_one.c_strings': true

        }
      }).execute()

      doc = load()

      doc.locales.c_string.length.should.equal(0)
      doc.locales.c_strings.length.should.equal(0)
      doc.locales.c_doc.c_string.length.should.equal(0)
      doc.locales.c_doc.c_strings.length.should.equal(0)
      doc.locales.c_docs.find(v => v.c_key === 'c_one').c_string.length.should.equal(0)
      doc.locales.c_docs.find(v => v.c_key === 'c_one').c_strings.length.should.equal(0)
      Boolean(doc.c_string === undefined).should.equal(true)
      doc.c_strings.should.deepEqual([])
      Boolean(doc.c_doc.c_string === undefined).should.equal(true)
      doc.c_doc.c_strings.should.deepEqual([])
      Boolean(doc.c_docs.find(v => v.c_key === 'c_one').c_string === undefined).should.equal(true)
      doc.locales.c_docs.find(v => v.c_key === 'c_one').c_strings.should.deepEqual([])

    }))

    it('works without a unique key', sandboxed(function() {

      /* global org, consts, script */

      script.locale = 'en_GB'

      let doc, _id, idOne, idTwo

      const { setAttributes } = require('c_ctxapi_164'),
            { equalIds, findIdInArray } = require('util.id'),
            should = require('should'),
            load = (locale = script.locale) => {
              return org.objects.c_ctxapi_164
                .find({ _id })
                .include('locales')
                .locale(locale)
                .next()
            }

      setAttributes({
        uniqueKey: ''
      })

      doc = org.objects.c_ctxapi_164.insertOne({
        c_docs: [{
          c_string: 'en_US one',
          c_strings: ['en_US one']
        }, {
          c_string: 'en_US two',
          c_strings: ['en_US two']
        }]
      }).locale('en_US').lean(false).execute()

      _id = doc._id

      idOne = doc.c_docs[0]._id
      idTwo = doc.c_docs[1]._id

      org.objects.c_ctxapi_164.updateOne({
        _id
      }, {
        $set: {
          c_docs: [{
            _id: idOne,
            c_string: 'en_GB one',
            c_strings: ['en_GB one']
          }, {
            _id: idTwo,
            c_string: 'en_GB two',
            c_strings: ['en_GB two']
          }]
        }
      }).execute()

      doc = load()

      findIdInArray(doc.c_docs, '_id', idOne).c_string.should.equal('en_GB one')
      findIdInArray(doc.c_docs, '_id', idOne).c_strings.should.deepEqual(['en_GB one'])
      findIdInArray(doc.c_docs, '_id', idTwo).c_string.should.equal('en_GB two')
      findIdInArray(doc.c_docs, '_id', idTwo).c_strings.should.deepEqual(['en_GB two'])
      findIdInArray(doc.locales.c_docs, '_id', idOne).c_string.length.should.equal(2)
      findIdInArray(doc.locales.c_docs, '_id', idOne).c_strings.length.should.equal(2)
      findIdInArray(doc.locales.c_docs, '_id', idTwo).c_string.length.should.equal(2)
      findIdInArray(doc.locales.c_docs, '_id', idTwo).c_strings.length.should.equal(2)
      should(equalIds(findIdInArray(doc.locales.c_docs, '_id', idOne)._id, findIdInArray(doc.c_docs, '_id', idOne)._id)).be.true()
      should(equalIds(findIdInArray(doc.locales.c_docs, '_id', idTwo)._id, findIdInArray(doc.c_docs, '_id', idTwo)._id)).be.true()

      doc = load('en_US')
      findIdInArray(doc.c_docs, '_id', idOne).c_string.should.equal('en_US one')
      findIdInArray(doc.c_docs, '_id', idOne).c_strings.should.deepEqual(['en_US one'])
      findIdInArray(doc.c_docs, '_id', idTwo).c_string.should.equal('en_US two')
      findIdInArray(doc.c_docs, '_id', idTwo).c_strings.should.deepEqual(['en_US two'])

      // unset ---------------------

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $unset: {
          [`c_docs.${idOne}.c_string`]: true,
          [`locales.c_docs.${idTwo}.c_strings`]: true
        }
      }).execute()

      doc = load()

      findIdInArray(doc.c_docs, '_id', idOne).c_string.should.equal('en_US one') // using fallback
      findIdInArray(doc.c_docs, '_id', idOne).c_strings.should.deepEqual(['en_GB one'])
      findIdInArray(doc.c_docs, '_id', idTwo).c_string.should.equal('en_GB two')
      findIdInArray(doc.c_docs, '_id', idTwo).c_strings.should.deepEqual([])
      findIdInArray(doc.locales.c_docs, '_id', idOne).c_string.length.should.equal(1)
      findIdInArray(doc.locales.c_docs, '_id', idOne).c_strings.length.should.equal(2)
      findIdInArray(doc.locales.c_docs, '_id', idTwo).c_string.length.should.equal(2)
      findIdInArray(doc.locales.c_docs, '_id', idTwo).c_strings.length.should.equal(0)
      should(equalIds(findIdInArray(doc.locales.c_docs, '_id', idOne)._id, findIdInArray(doc.c_docs, '_id', idOne)._id)).be.true()
      should(equalIds(findIdInArray(doc.locales.c_docs, '_id', idTwo)._id, findIdInArray(doc.c_docs, '_id', idTwo)._id)).be.true()

      // push/pull ---------------------

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $push: {
          c_docs: [{
            _id: idOne,
            c_strings: ['u', 's', 'a']
          }]
        },
        $pull: {
          [`c_docs.${idOne}.c_strings`]: ['en_US one', 'a']
        }
      }).locale('en_US').execute()

      doc = load('en_US')

      findIdInArray(doc.c_docs, '_id', idOne).c_strings.should.deepEqual(['u', 's'])

      // direct ---------------------

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $set: {
          locales: {
            c_docs: [{
              _id: idOne,
              c_strings: [{
                locale: 'en_US',
                value: ['u', 's', 'a']
              }]
            }]
          }
        },
        $push: {
          locales: {
            c_docs: [{
              _id: idOne,
              c_strings: [{
                locale: 'fr_CA',
                value: ['bonjour', 'mon', 'ami']
              }]
            }]
          }
        }
      }).execute()

      doc = load('en_US')
      findIdInArray(doc.c_docs, '_id', idOne).c_strings.should.deepEqual(['u', 's', 'a'])

      doc = load('fr_CA')
      findIdInArray(doc.c_docs, '_id', idOne).c_strings.should.deepEqual(['bonjour', 'mon', 'ami'])
    }))

    it('turning off localization should fail', sandboxed(function() {

      /* global org, consts, script */

      require('should')

      const { setAttributes } = require('c_ctxapi_164'),
            { tryCatch } = require('util.values'),
            pathTo = require('util.paths.to')

      function expectValidationError(err, path, code = 'kInvalidArgument') {
        if (pathTo(err, 'errCode') === 'cortex.invalidArgument.validation' &&
          pathTo(err, 'faults.0.code') === code &&
          pathTo(err, 'faults.0.path') === path
        ) {
          return true
        }
        throw err || new Error(`Expected ${code} for ${path}`)
      }

      // remove unique key for configured exports
      tryCatch(() => {
        setAttributes({
          localization: {
            enabled: false
          }
        })
      }, err => expectValidationError(err, 'object.properties[]#String.localization.enabled'))

    }))

    it('fallback locales', sandboxed(function() {

      // @todo

    }))

    it('strict settings', sandboxed(function() {

      // @todo

    }))

    it('locales document acl', sandboxed(function() {

      /* global org, consts, script */

      require('should')

      const { setAttributes } = require('c_ctxapi_164')

      script.locale = 'en_GB'

      // add a role
      if (!org.read('roles').find(v => v.code === 'c_ctxapi_164')) {
        org.objects.org.updateOne({ code: org.code }, {
          $push: {
            roles: [{
              code: 'c_ctxapi_164',
              name: 'CTXAPI-164',
              include: []
            }]
          }
        }).execute()
      }

      setAttributes({
        localization: {
          aclOverride: true,
          acl: ['role.c_ctxapi_164.update', 'owner.read']
        }
      })

      let _id = org.objects.c_ctxapi_164.insertOne({
        c_string: 'en_US'
      }).locale('en_US').execute()

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $set: {
          c_string: 'en_GB'
        }
      }).execute()

      try {
        org.objects.c_ctxapi_164.updateOne({ _id }, {
          $set: {
            locales: {
              c_string: [{
                locale: 'en_US',
                value: 'en_US direct'
              }]
            }
          }
        }).execute()
      } catch (err) {
        if (err.code !== 'kAccessDenied') {
          throw err
        }
      }

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $set: {
          locales: {
            c_string: [{
              locale: 'en_US',
              value: 'en_US direct'
            }]
          }
        }
      }).grant(consts.accessLevels.update).execute()

      org.objects.c_ctxapi_164.updateOne({ _id }, {
        $set: {
          locales: {
            c_string: [{
              locale: 'en_US',
              value: 'en_US direct'
            }]
          }
        }
      }).roles('c_ctxapi_164').execute()

    }))

  })

})
