'use strict'

/* global org, script, CortexObject */

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      sandboxed = require('../../lib/sandboxed')

describe('Modules', function() {

  describe('Script.as', function() {

    before(function(done) {

      async.series([
        callback => {
          modules.db.models.Object.aclCreate(server.principals.admin, {
            name: 'c_script_as_scoping_object',
            label: 'Script.as Scoping Object',
            defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
            createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
            shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
            properties: [
              { label: 'String', name: 'c_description', type: 'String' },
              { label: 'Number', name: 'c_rating', type: 'Number' }
            ]
          }, (err) => {
            callback(err)
          })
        },
        callback => {
          modules.db.models.view.aclCreate(
            server.principals.admin,
            {
              label: 'script_as_view_test',
              name: 'c_script_as_view_test',
              sourceObject: 'account',
              acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
              objectAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier, allow: acl.AccessLevels.Connected }]
            },
            err => {
              callback(err)
            }
          )
        }
      ], done)

    })

    describe('Simple User Tests', function() {

      it('Should run script as admin', sandboxed(function() {

        const should = require('should'),
              result = script.as(
                'james+admin@medable.com',
                {
                  principal: {
                    roles: [],
                    scope: ['object.read.*.*.*'],
                    skipAcl: false,
                    bypassCreateAcl: false
                  },
                  acl: {
                    safe: true
                  },
                  modules: {
                    safe: false,
                    blacklist: [],
                    whitelist: ['script.as', 'objects.*']
                  }
                },

                () => {
                  return org.objects.accounts.find().toList()
                }
              )

        should.exist(result)
        result.object.should.equal('list')
        result.data.length.should.equal(1)
        result.data[0].email.should.equal('james+admin@medable.com')

      }))

      it('Should run script as provider', sandboxed(function() {

        const should = require('should'),
              result = script.as(
                'james+provider@medable.com',
                {
                  principal: {
                    roles: [],
                    scope: ['object.read.*.*.*'],
                    skipAcl: false,
                    bypassCreateAcl: false
                  },
                  acl: {
                    safe: true
                  },
                  modules: {
                    safe: false,
                    blacklist: [],
                    whitelist: ['script.as', 'objects.*']
                  }
                },

                () => {
                  return org.objects.accounts.find().toList()
                }
              )

        should.exist(result)
        result.object.should.equal('list')
        result.data.length.should.equal(1)
        result.data[0].email.should.equal('james+provider@medable.com')

      }))

      it('Should run script as patient', sandboxed(function() {

        const should = require('should'),
              result = script.as(
                'james+patient@medable.com',
                {
                  principal: {
                    roles: [],
                    scope: ['object.read.*.*.*'],
                    skipAcl: false,
                    bypassCreateAcl: false
                  },
                  acl: {
                    safe: true
                  },
                  modules: {
                    safe: false,
                    blacklist: [],
                    whitelist: ['script.as', 'objects.*']
                  }
                },

                () => {
                  return org.objects.accounts.find().toList()
                }
              )

        should.exist(result)
        result.object.should.equal('list')
        result.data.length.should.equal(1)
        result.data[0].email.should.equal('james+patient@medable.com')

      }))

    })

    describe('Acl Safety Options', function() {

      it('Should only return one account with safe acl', sandboxed(function() {

        require('should')

        const result = script.as(
          'james+admin@medable.com',
          {
            principal: {
              roles: [],
              scope: ['object.read.*.*.*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: true
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            return org.objects.accounts.find().skipAcl().grant(6).toList()
          })

        result.object.should.equal('list')
        result.data.length.should.equal(1)
        result.data[0].email.should.equal('james+admin@medable.com')

      }))

      it('Should return multiple accounts with unsafe acl', sandboxed(function() {

        const should = require('should'),
              result = script.as(
                'james+admin@medable.com',
                {
                  principal: {
                    roles: [],
                    scope: ['object.read.*.*.*'],
                    skipAcl: false,
                    bypassCreateAcl: false
                  },
                  acl: {
                    safe: false
                  },
                  modules: {
                    safe: false,
                    blacklist: [],
                    whitelist: ['script.as', 'objects.*']
                  }
                },

                () => {
                  return org.objects.accounts.find().skipAcl().grant(6).toList()
                }
              )

        should.exist(result)
        result.object.should.equal('list')
        result.data.length.should.be.above(1)

      }))

      it('Should error with unsafe acl and grant in the blacklist', sandboxed(function() {

        const should = require('should')
        try {
          script.as(
            'james+admin@medable.com',
            {
              principal: {
                roles: [],
                scope: ['object.read.*.*.*'],
                skipAcl: false,
                bypassCreateAcl: false
              },
              acl: {
                safe: false,
                blacklist: [
                  'grant'
                ]
              },
              modules: {
                safe: false,
                blacklist: [],
                whitelist: ['script.as', 'objects.*']
              }
            },

            () => {
              return org.objects.accounts.find().skipAcl().grant(6).toList()
            }
          )
        } catch (err) {
          should.exist(err)
          err.code.should.equal('kAccessDenied')
          return
        }
        throw new Error('Should have thrown')

      }))

      it('Should only return one account with unsafe acl and skipAcl in the blacklist', sandboxed(function() {

        require('should')

        const result = script.as(
          'james+admin@medable.com',
          {
            principal: {
              roles: [],
              scope: ['object.read.*.*.*'],
              skipAcl: false,
              bypassCreateAcl: false
            },
            acl: {
              safe: false,
              blacklist: [
                'skipAcl'
              ]
            },
            modules: {
              safe: false,
              blacklist: [],
              whitelist: ['script.as', 'objects.*']
            }
          },

          () => {
            return org.objects.accounts.find().skipAcl().grant(6).toList()
          }
        )

        result.object.should.equal('list')
        result.data.length.should.equal(1)
        result.data[0].email.should.equal('james+admin@medable.com')

      }))

    })

    describe('Scope Testing', function() {

      describe('Objects', function() {
        it('Should only return the name element', sandboxed(function() {

          const should = require('should'),
                result = script.as(
                  'james+admin@medable.com',
                  {
                    principal: {
                      roles: [],
                      scope: ['object.read.*.*.name'],
                      skipAcl: false,
                      bypassCreateAcl: false
                    },
                    acl: {
                      safe: false,
                      blacklist: [
                        'skipAcl'
                      ]
                    },
                    modules: {
                      safe: false,
                      blacklist: [],
                      whitelist: ['script.as', 'objects.*']
                    }
                  },

                  () => {
                    return org.objects.accounts.find().toList()
                  }
                )
          result.object.should.equal('list')
          result.data.length.should.equal(1)
          should.exist(result.data[0].name)
          should.not.exist(result.data[0].email)

        })
        )

        it('Should create scoping object instance, read and return it', sandboxed(function() {

          require('should')

          let result = script.as(
            'james+admin@medable.com',
            {
              principal: {
                roles: [],
                scope: ['object.*'],
                skipAcl: false,
                bypassCreateAcl: false
              },
              acl: {
                safe: false,
                blacklist: [
                  'skipAcl'
                ]
              },
              modules: {
                safe: false,
                blacklist: [],
                whitelist: ['script.as', 'objects.*']
              }
            },

            () => {

              const ScopeObj = CortexObject.as('c_script_as_scoping_object'),
                    _id = ScopeObj.insertOne({ c_description: 'Great', c_rating: 5 }).execute()
              return ScopeObj.find({ _id: _id }).toList()

            }
          )

          result.object.should.equal('list')
          result.data.length.should.equal(1)
          result.object.should.equal('list')
          result.data[0].c_rating.should.equal(5)

          return result
        })
        )

        it('Should fail to read created object', sandboxed(function() {

          require('should')

          try {

            script.as(
              'james+admin@medable.com',
              {
                principal: {
                  roles: [],
                  scope: ['object.create', 'object.update'],
                  skipAcl: false,
                  bypassCreateAcl: false
                },
                acl: {
                  safe: false,
                  blacklist: [
                    'skipAcl'
                  ]
                },
                modules: {
                  safe: false,
                  blacklist: [],
                  whitelist: ['script.as', 'objects.*']
                }
              },

              () => {

                const ScopeObj = CortexObject.as('c_script_as_scoping_object'),
                      _id = ScopeObj.insertOne({ c_description: 'Great', c_rating: 5 }).execute()
                return ScopeObj.find({ _id: _id }).toList()

              }
            )
          } catch (err) {
            err.errCode.should.equal('cortex.accessDenied.scope')
            err.path.should.equal('object.read.c_script_as_scoping_object')
            return
          }
          throw new Error('Should have thrown')

        })
        )

        it('Should inherit update privileges for create', sandboxed(function() {

          script.as(
            'james+admin@medable.com',
            {
              principal: {
                roles: [],
                scope: ['object.create'],
                skipAcl: false,
                bypassCreateAcl: false
              },
              acl: {
                safe: false,
                blacklist: [
                  'skipAcl'
                ]
              },
              modules: {
                safe: false,
                blacklist: [],
                whitelist: ['script.as', 'objects.*']
              }
            },

            () => {

              const ScopeObj = CortexObject.as('c_script_as_scoping_object')
              return ScopeObj.insertOne({ c_description: 'Great', c_rating: 5 }).lean(true).execute()
            }
          )

          return true

        })
        )
      })

      describe('Views', function() {

        it('should execute view', function(done) {

          sandboxed(function() {
            require('should')

            let result = script.as(
              'james+admin@medable.com',
              {
                principal: {
                  roles: [],
                  scope: ['view.execute.c_script_as_view_test'],
                  skipAcl: false,
                  bypassCreateAcl: false
                },
                acl: {
                  safe: false,
                  blacklist: [
                    'skipAcl'
                  ]
                },
                modules: {
                  safe: false,
                  blacklist: [],
                  whitelist: ['script.as', 'view.*']
                }
              },

              () => {

                return require('views').run('c_script_as_view_test')

              }
            )

            return result
          })((err, result) => {
            should.not.exist(err)
            should.exist(result)
            result.object.should.equal('list')
            result.data.length.should.above(3)
            result.data[0].object.should.equal('account')

            done()
          })
        })

        it('should fail to execute view without view scope', sandboxed(function() {
          require('should')

          try {
            script.as(
              'james+admin@medable.com',
              {
                principal: {
                  roles: [],
                  scope: ['object.*'],
                  skipAcl: false,
                  bypassCreateAcl: false
                },
                acl: {
                  safe: false,
                  blacklist: [
                    'skipAcl'
                  ]
                },
                modules: {
                  safe: false,
                  blacklist: [],
                  whitelist: ['script.as', 'view.*']
                }
              },

              () => {

                return require('views').run('c_script_as_view_test')

              }
            )
          } catch (err) {
            err.errCode.should.equal('cortex.accessDenied.scope')
            return
          }
          throw new Error('Should have thrown')

        })
        )

        it('should fail to execute view without the scope of what the view accesses', sandboxed(function() {
          require('should')

          try {
            script.as(
              'james+admin@medable.com',
              {
                principal: {
                  roles: [],
                  scope: ['view.*'],
                  skipAcl: false,
                  bypassCreateAcl: false
                },
                acl: {
                  safe: false,
                  blacklist: [
                    'skipAcl'
                  ]
                },
                modules: {
                  safe: false,
                  blacklist: [],
                  whitelist: ['script.as', 'view.run']
                }
              },

              () => {

                return require('views').run('c_script_as_view_test')

              }
            )
          } catch (err) {
            // TODO: this error isn't as expected?
            return
          }
          throw new Error('Should have thrown')
        })
        )
      })
    })

    describe('Script.as Calls Script.as', function() {

      it('should succeed to return account', function(done) {

        sandboxed(function() {

          return script.as(
            'james+admin@medable.com',
            {
              principal: {
                roles: [],
                scope: ['view.*'],
                skipAcl: false,
                bypassCreateAcl: false
              },
              acl: {
                safe: false,
                blacklist: []
              },
              modules: {
                safe: false,
                blacklist: [],
                whitelist: ['script.as', 'objects.*']
              }
            },

            () => {

              return script.as(
                'james+admin@medable.com',
                {
                  principal: {
                    roles: [],
                    scope: ['object.read.account'],
                    skipAcl: false,
                    bypassCreateAcl: false
                  },
                  acl: {
                    safe: false,
                    blacklist: []
                  },
                  modules: {
                    safe: false,
                    blacklist: [],
                    whitelist: ['objects.*']
                  }
                },

                () => {

                  return org.objects.accounts.find().skipAcl().grant(6).toList()

                }
              )

            }
          )

        })((err, result) => {

          should.not.exist(err)
          should.exist(result)
          result.object.should.equal('list')
          result.data.length.should.above(3)
          result.data[0].object.should.equal('account')

          done()

        })
      })

      it('should fail escalate ACL on second call', function(done) {

        sandboxed(function() {
          require('should')

          let result = script.as(
            'james+admin@medable.com',
            {
              principal: {
                roles: [],
                scope: ['object.*'],
                skipAcl: false,
                bypassCreateAcl: false
              },
              acl: {
                safe: true,
                blacklist: []
              },
              modules: {
                safe: false,
                blacklist: [],
                whitelist: ['script.as', 'objects.*']
              }
            },

            () => {

              let result = script.as(
                'james+admin@medable.com',
                {
                  principal: {
                    roles: [],
                    scope: ['object.*'],
                    skipAcl: false,
                    bypassCreateAcl: false
                  },
                  acl: {
                    safe: false,
                    blacklist: []
                  },
                  modules: {
                    safe: false,
                    blacklist: [],
                    whitelist: ['script.as', 'objects.*']
                  }
                },

                () => {

                  return org.objects.accounts.find().skipAcl().grant(6).toList()

                }
              )

              return result

            }
          )

          return result
        })((err, result) => {
          should.not.exist(err)
          should.exist(result)
          result.object.should.equal('list')
          result.data.length.should.equal(1)
          result.data[0].object.should.equal('account')

          done()
        })
      })

      it('should fail if current script.as has wrong scope', sandboxed(function() {
        require('should')

        try {
          script.as(
            'james+admin@medable.com',
            {
              principal: {
                roles: [],
                scope: ['object.*'],
                skipAcl: false,
                bypassCreateAcl: false
              },
              acl: {
                safe: true,
                blacklist: []
              },
              modules: {
                safe: false,
                blacklist: [],
                whitelist: ['script.as', 'objects.*']
              }
            },

            () => {

              let result = script.as(
                'james+admin@medable.com',
                {
                  principal: {
                    roles: [],
                    scope: [],
                    skipAcl: false,
                    bypassCreateAcl: false
                  },
                  acl: {
                    safe: false,
                    blacklist: []
                  },
                  modules: {
                    safe: false,
                    blacklist: [],
                    whitelist: ['script.as', 'objects.*']
                  }
                },

                () => {

                  return org.objects.accounts.find().skipAcl().grant(6).toList()

                }
              )

              return result

            }
          )
        } catch (err) {
          err.errCode.should.equal('cortex.accessDenied.scope')
          return
        }
        throw new Error('Should have thrown')
      })
      )
    })

    describe('Auth Tokens', function() {
      let tokens = null

      before(function(done) {
        const code = function() {

                const appKey = 'CLIENT_KEY',
                      api = require('api'),
                      principal = api.principal.create('james+provider@medable.com'),
                      adminToken = org.objects.accounts.createAuthToken(appKey, script.principal, { scope: ['*'] }),
                      adminLimScope = org.objects.accounts.createAuthToken(appKey, script.principal, { scope: ['object.read.*', 'script.*'] }),
                      adminNoRunnerScope = org.objects.accounts.createAuthToken(appKey, script.principal, { scope: ['object.read.*', 'script.execute.route'] }),
                      providerToken = org.objects.accounts.createAuthToken(appKey, principal, { scope: ['*'] }),
                      retVal = {
                        adminToken,
                        adminLimScope,
                        adminNoRunnerScope,
                        providerToken
                      }

                return retVal
              },
              codeStr = code.toString()
                .replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim()
                .replace('CLIENT_KEY', server.sessionsClient.key),

              source = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

        server.sessions.admin
          .post(server.makeEndpoint('/sys/script_runner'))
          .set(server.getSessionHeaders())
          .send(source)
          .done(function(err, result) {
            should.not.exist(err)
            tokens = result.data
            done()
          })

      })

      it('should allow all accounts to list with admin Auth token', function(done) {

        const code = function() {

                return script.as(
                  'james+admin@medable.com',
                  {
                    principal: {
                      roles: [],
                      scope: ['object.*'],
                      skipAcl: false,
                      bypassCreateAcl: false
                    },
                    acl: {
                      safe: false,
                      blacklist: []

                    },
                    modules: {
                      safe: false,
                      blacklist: [],
                      whitelist: ['script.as', 'objects.*']
                    }
                  },

                  () => {

                    return org.objects.accounts.find().skipAcl().grant(6).toList()

                  }
                )
              },
              codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
              source = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/sys/script_runner'))
          .set({
            'Medable-Client-Key': server.sessionsClient.key,
            'Authorization': 'Bearer ' + tokens.adminToken
          })
          .send(source)
          .done((err, result) => {
            should.not.exist(err)
            result.object.should.equal('list')
            result.data.length.should.above(3)
            result.data[0].object.should.equal('account')
            done()
          })

      })

      it('should fail to call script runner with provider token', function(done) {

        const code = function() {

                return script.as(
                  'james+admin@medable.com',
                  {
                    principal: {
                      roles: [],
                      scope: ['object.*'],
                      skipAcl: false,
                      bypassCreateAcl: false
                    },
                    acl: {
                      safe: false,
                      blacklist: []

                    },
                    modules: {
                      safe: false,
                      blacklist: [],
                      whitelist: ['script.as', 'objects.*']
                    }
                  },

                  () => {
                    return org.objects.accounts.find().skipAcl().grant(6).toList()
                  }
                )

              },
              codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
              source = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/sys/script_runner'))
          .set({
            'Medable-Client-Key': server.sessionsClient.key,
            'Authorization': 'Bearer ' + tokens.providerToken
          })
          .send(source)
          .done((err, result) => {
            should.exist(err)
            err.errCode.should.equal('cortex.accessDenied.role')
            done()
          })

      })

      it('should allow all accounts to list with limited scope Auth token', function(done) {

        const code = function() {

                return script.as(
                  'james+admin@medable.com',
                  {
                    principal: {
                      roles: [],
                      scope: ['object.*'],
                      skipAcl: false,
                      bypassCreateAcl: false
                    },
                    acl: {
                      safe: false,
                      blacklist: []

                    },
                    modules: {
                      safe: false,
                      blacklist: [],
                      whitelist: ['script.as', 'objects.*']
                    }
                  },
                  () => {
                    return org.objects.accounts.find().skipAcl().grant(6).toList()
                  }
                )
              },
              codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
              source = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/sys/script_runner'))
          .set({
            'Medable-Client-Key': server.sessionsClient.key,
            'Authorization': 'Bearer ' + tokens.adminLimScope
          })
          .send(source)
          .done((err, result) => {
            should.not.exist(err)
            result.object.should.equal('list')
            result.data.length.should.above(3)
            result.data[0].object.should.equal('account')
            done()
          })

      })

      it('should fail to allow adhoc scripts to run without script.execute.runner scope', function(done) {

        const code = function() {

                return script.as(
                  'james+admin@medable.com',
                  {
                    principal: {
                      roles: [],
                      scope: ['object.*'],
                      skipAcl: false,
                      bypassCreateAcl: false
                    },
                    acl: {
                      safe: false,
                      blacklist: []

                    },
                    modules: {
                      safe: false,
                      blacklist: [],
                      whitelist: ['script.as', 'objects.*']
                    }
                  },
                  () => {
                    const ScopeObj = CortexObject.as('c_script_as_scoping_object'),
                          _id = ScopeObj.insertOne({ c_description: 'and the good', c_rating: 4 }).execute()
                    return ScopeObj.find({ _id: _id }).toList()
                  }
                )
              },
              codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
              source = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

        supertest(server.api.expressApp)
          .post(server.makeEndpoint('/sys/script_runner'))
          .set({
            'Medable-Client-Key': server.sessionsClient.key,
            'Authorization': 'Bearer ' + tokens.adminNoRunnerScope
          })
          .send(source)
          .done((err, result) => {
            should.exist(err)
            done()
          })
      })

    })

  })
})
