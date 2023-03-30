'use strict'

const _ = require('underscore'),
      { ObjectID } = require('cortex-service/lib/utils/ids'),
      OBJECT_ID_REGEXP = require('cortex-service/lib/utils/ids').OBJECT_ID_REGEXP,
      OBJECT_NAME_AND_TYPE_REGEXP = /^[a-z0-9-_]{1,40}(#[a-z0-9-_]{1,40})?$/,
      OBJECT_NAME_REGEXP = /^[a-z0-9-_]{1,40}$/,
      consts = {

        API_KEY_LENGTH: 22,
        API_SECRET_LENGTH: 64,

        emptyId: new ObjectID('000000000000000000000000'),

        Genders: {
          Male: 'm',
          Female: 'f',
          Trans: 't',
          Other: 'o',
          Neither: 'n',
          Unspecified: 'u'
        },

        metadata: {

          updateBits: {
            documentSize: 1, // the document size has changed
            migrate: 2, // updates made during a migration require processing before migration can complete.
            history: 3 // property history exists.
          }

        },

        auth: {

          scopes: [
            [
              'object', // object (custom or native. includes native objects like locations, logs, etc.)
              ['*', 'create', 'read', 'update', 'delete'], // crud
              ['*', OBJECT_NAME_AND_TYPE_REGEXP], // object[#type]
              ['*', OBJECT_ID_REGEXP], // object id
              ['$fqpp'] // fqpp
            ],
            [
              'deployment', // deployment
              ['*', 'execute'], // execute
              [OBJECT_ID_REGEXP] // object id
            ],
            [
              'script', // script
              ['*', 'execute'], // execute
              ['*', 'route', 'runner'], // script type
              [OBJECT_ID_REGEXP] // script id
            ],
            [
              'view', // view
              ['*', 'execute'], // execute
              [OBJECT_NAME_REGEXP, OBJECT_ID_REGEXP] // code, object id
            ],
            [
              '*'
            ],
            [
              'upload' // create uploads
            ],
            [
              'admin',
              ['*', 'read', 'update']
            ],
            [
              'user',
              OBJECT_NAME_REGEXP
            ],
            [
              'ws',
              ['*', 'publish', 'subscribe'],
              ['*', OBJECT_NAME_AND_TYPE_REGEXP], // object[#type]
              ['$uniqueKey'] // object id or uuid or custom name
            ]

          ]
        },

        messages: {
          states: {
            pending: 1,
            processing: 3,
            scheduled: 5
          }
        },

        events: {

          states: {
            scheduled: 0,
            pending: 1,
            processing: 2,
            completed: 3,
            failed: 4,
            skipped: 5
          },

          types: {
            script: new ObjectID('4576656e7420536372697074'),
            notification: new ObjectID('4576656e74204e6f74696620'),
            console: new ObjectID('4576656e7420436f6e736f6c'),
            driver: new ObjectID('4576656e7420447269766572')
          },

          retention: {
            never: 0,
            failed: 1,
            completed: 2,
            skipped: 4
          }

        },

        workers: {

          states: {
            queued: 'queued',
            starting: 'starting',
            started: 'started',
            stopping: 'stopping',
            stopped: 'stopped'
          },

          types: {
            cerebrum: {
              _id: new ObjectID('57726b72204365726562726d')
            }
          }

        },

        callbacks: {
          ver_acct: 'ver-acct',
          pass_reset: 'pass-reset',
          act_acct: 'act-acct',
          ver_location: 'ver-location'
        },

        scripts: {
          types: {
            job: new ObjectID('536372697074204a6f622020'),
            library: new ObjectID('536372697074204c69622020'),
            route: new ObjectID('53637269707420526f757465'),
            trigger: new ObjectID('536372697074205472696772')
          }
        },

        expressions: {
          types: {
            expression: new ObjectID('45787072204578707273736e'),
            pipeline: new ObjectID('4578707220506970656c6e20')
          }
        },

        roomEvents: {
          types: {
            room: new ObjectID('526f6f6d45767420526f6f6d'),
            participant: new ObjectID('526f6f6d4576742050617274'),
            track: new ObjectID('526f6f6d457674205472636b'),
            recording: new ObjectID('526f6f6d457674205265636f'),
            composition: new ObjectID('526f6f6d45767420436f6d70'),
            message: new ObjectID('526f6f6d457674204d657373'),
            user: new ObjectID('526f6f6d4576742055736572')
          }
        },

        connectionStates: {
          pending: 0, // eg. invitation
          active: 1 // active. acls applied
        },

        accountStates: {
          unverified: 'unverified',
          verified: 'verified'
        },

        orgStates: {
          enabled: 'enabled',
          disabled: 'disabled'
        },

        deployment: {

          availability: {
            target: 0,
            source: 1,
            both: 2
          },

          selections: {
            all: 0,
            none: 1,
            include: 2,
            exclude: 3
          },

          mapping: {

            types: {
              config: 'cfg',
              object: 'obj',
              script: 'scr',
              view: 'viw',
              serviceAccount: 'sva',
              template: 'tpl',
              notification: 'ntf',
              role: 'rle',
              sms: 'sms',
              app: 'app',
              account: 'act',
              policy: 'pol'
            }

          }
        },

        roles: {
          admin: new ObjectID('000000000000000000000004'),
          provider: new ObjectID('000000000000000000000005'),
          support: new ObjectID('000000000000000000000006'),
          developer: new ObjectID('000000000000000000000007')
        },

        principals: {
          anonymous: new ObjectID('000000000000000000000001'),
          public: new ObjectID('000000000000000000000003')
        },

        ProviderStates: {
          Unverified: 'unverified',
          Verified: 'verified',
          Processing: 'processing',
          Revoked: 'revoked'
        },

        // these are hidden from the api.
        NativeModels: {
          template: new ObjectID('4f626a6563742054706c2020'),
          transaction: new ObjectID('4f626a656374205472782020'),
          message: new ObjectID('4f626a656374204d73672020'),
          upload: new ObjectID('436f6e746578742055706c64'),
          sysconfig: new ObjectID('436f6e7465787420436f6e66')
        },

        // these are non-context object models exposed to the api.
        NativeObjects: {
          post: new ObjectID('4f626a65637420506f737420'),
          comment: new ObjectID('4f626a65637420436f6d6e74'),
          location: new ObjectID('4f626a656374204c6f632020'),
          notification: new ObjectID('4f626a656374204e6f746966'),
          connection: new ObjectID('4f626a65637420436f6e6e20'),
          stat: new ObjectID('4f626a656374205374617420'),
          log: new ObjectID('4f626a656374204c6f672020'),
          token: new ObjectID('4f626a65637420546f6b656e')
        },

        NativeIds: {
          audit: new ObjectID('436f6e746578742041756474'),
          account: new ObjectID('436f6e746578742041636374'),
          conversation: new ObjectID('436f6e7465787420436f6e76'),
          org: new ObjectID('436f6e74657874204f726720'),
          script: new ObjectID('436f6e746578742053637269'),
          object: new ObjectID('436f6e746578742043747820'),
          patientfile: new ObjectID('436f6e746578742050746e74'),
          view: new ObjectID('436f6e746578742056696577'),
          deployment: new ObjectID('436f6e74657874204465706c'),
          export: new ObjectID('436f6e746578742045787074'),
          history: new ObjectID('436f6e746578742048697374'),
          signature: new ObjectID('436f6e746578742045536967'),
          package: new ObjectID('4f626a65637420506b672020'),
          room: new ObjectID('436f6e7465787420526f6f6d'),
          roomevent: new ObjectID('436f6e7465787420526d4c67'),
          composition: new ObjectID('436f6e7465787420436f6d70'),
          event: new ObjectID('436f6e746578744576656e74'),
          oo: new ObjectID('436f6e74657874204f4f626a'),
          expression: new ObjectID('436f6e746578742045787072'),
          idp: new ObjectID('436f6e746578742049647020'),
          i18n: new ObjectID('436f6e74657874206931386e'),
          i18nBundle: new ObjectID('43786931386e62756e646c65')
        },

        LegacyObjectIds: {
          conversation: new ObjectID('436f6e7465787420436f6e76'),
          patientfile: new ObjectID('436f6e746578742050746e74')
        },

        Tokens: {
          Invitation: 'collab'
        },

        TokenStates: {
          Pending: 'pending'
        },

        sso: {
          idp: {
            types: {
              oidc: new ObjectID('53534f20494450204f494443'),
              saml2: new ObjectID('53534f204944502053414d4c')
            }
          }
        },

        Nodes: {
          Types: {
            property: 0,
            array: 1,
            nested: 2,
            schema: 3,
            multi: 5,
            virtual: 6,
            root: 7
          }
        },
        http: {
          methods: {
            GET: 0,
            POST: 1,
            PUT: 2,
            DELETE: 3,
            HEAD: 4,
            OPTIONS: 5,
            PATCH: 6
          }
        },

        history: {
          operations: {
            set: 1,
            remove: 2,
            push: 3,
            pull: 4
          }
        },

        audits: {
          operations: {
            set: 1,
            remove: 2, // remove a property value
            push: 3,
            pull: 4,
            delete: 5, // delete an instance
            access: 9 // instance access granted/removed.
          },
          categories: {
            notifications: {
              label: 'Notifications',
              subs: {
                send: { label: 'Send' }
              }
            },
            account: {
              label: 'Accounts',
              subs: {
                create: { label: 'Create' },
                read: { label: 'Read' },
                update: { label: 'Update' },
                delete: { label: 'Delete' },
                access: { label: 'Access' },
                locked: { label: 'Locked' }
              }
            },
            // authentication events. this could be login, session timeout, token
            authentication: {
              label: 'Authentication',
              subs: {
                login: { label: 'Login' },
                logout: { label: 'Logout' },
                token: { label: 'Token Created' },
                ended: { label: 'Session Ended' },
                reset: { label: 'Password Reset' },
                device: { label: 'Device Added' }
              }
            },
            // org/env configuration
            configuration: {
              label: 'Configuration',
              subs: {
                create: { label: 'Create' },
                read: { label: 'Read' },
                update: { label: 'Update' },
                delete: { label: 'Delete' },
                access: { label: 'Access' }
              }
            },
            // user-land instance events. encompasses.
            user: {
              label: 'Custom',
              subs: {
                create: { label: 'Create' },
                read: { label: 'Read' },
                update: { label: 'Update' },
                delete: { label: 'Delete' },
                access: { label: 'Access' },
                transfer: { label: 'Transfer' }
              }
            },
            // deployments
            deployment: {
              label: 'Deployments',
              subs: {
                create: { label: 'Create' },
                read: { label: 'Read' },
                update: { label: 'Update' },
                delete: { label: 'Delete' },
                execute: { label: 'Execute' }
              }
            },
            // exports
            export: {
              label: 'Exports',
              subs: {
                create: { label: 'Create' },
                read: { label: 'Read' },
                update: { label: 'Update' },
                delete: { label: 'Delete' }
              }
            },
            // rooms
            room: {
              label: 'Rooms',
              subs: {
                create: { label: 'Create' },
                read: { label: 'Read' },
                update: { label: 'Update' },
                delete: { label: 'Delete' }
              }
            },
            // developer events of note. script runner, debugging sessions, etc.
            developer: {
              label: 'Developer',
              subs: {
                runner: { label: 'Script Execution' }
              }
            },
            support: {
              label: 'Support',
              subs: {
                login: { label: 'Support Login' },
                script: { label: 'Script Execution' }
              }
            },
            metadata: {
              label: 'Metadata',
              subs: {
                request: { label: 'Associated Request Details' }
              }
            }
          }
        },

        media: {
          states: {
            pending: 0, // waiting for upload
            processing: 1, // transcoding, manual processing, etc.
            ready: 2, // can be streamed
            error: 3, // error state (error included in segment. still alive)
            dead: 4 // unrecoverable error or too many retry attempts
          }
        },

        logs: {

          sources: {
            logger: 0,
            api: 1,
            script: 2,
            request: 3,
            reserved: 4, // used to be audit.
            deployment: 5,
            export: 6,
            notification: 7,
            policy: 8
          },

          levels: {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
          }

        },

        stats: {

          sources: {
            request: 0,
            fileStorage: 1,
            docStorage: 2,
            logins: 3,
            accounts: 4,
            scripts: 5,
            notifications: 6,
            cacheStorage: 7,
            roomUsage: 8
          },

          locations: {
            medable: 1,
            s3: 2
          }
        },

        operations: {

          codes: {
            fileStorage: 1,
            docStorage: 2,
            roomCreated: 3
          }

        },

        storage: {

          availableLocationTypes: {
            default: 'default',
            medable: 'medable',
            public: 'public',
            any: 'any',
            env: 'env'
          }

        },

        LocationTypes: {
          File: 3,
          AwsS3: 4,
          AwsS3Upload: 5,
          Buffer: 6,
          UploadObject: 7
        },

        Properties: {

          Ids: {
            Room: {
              Room: new ObjectID('50726f70526f6f6d526f6f6d'),
              State: new ObjectID('50726f70526f6f6d53747465'),
              Recording: new ObjectID('50726f70526f6f6d5265636f'),
              RawRecording: new ObjectID('50726f70526f6f6d52617772')
            },
            RoomEvent: {
              Room: new ObjectID('50726f70526d4c67526f6f6d'),
              Name: new ObjectID('50726f70526d4c674e616d65'),
              Account: new ObjectID('50726f70526d4c6741636374'),
              Order: new ObjectID('50726f70526d4c674f726472')
            },
            Composition: {
              Context: new ObjectID('50726f70436f6d7043747874'),
              Remote: new ObjectID('50726f70436f6d7052656d74'),
              State: new ObjectID('50726f70436f6d7053747465'),
              Start: new ObjectID('50726f70436f6d7053747274'),
              File: new ObjectID('50726f70436f6d7046696c65')
            },
            Expression: {
              Name: new ObjectID('50726f70457870724e616d65')
            },
            Idp: {
              Name: new ObjectID('50726f70496470204e616d65'),
              UUID: new ObjectID('50726f704964702055554944')
            }
          },
          Files: {
            Ids: {
              Account: {
                Image: new ObjectID('50726f7041636374496d6167')
              },
              Conversation: {
                Attachments: new ObjectID('50726f70436f6e7641747461')
              },
              PatientFile: {
                Image: new ObjectID('50726f7050617469496d6167')
              },
              Org: {
                Favicon: new ObjectID('50726f704f72674661766963'),
                Logo: new ObjectID('50726f704f72674c6f676f20')
              },
              Export: {
                Data: new ObjectID('50726f704578707444617461'),
                Files: new ObjectID('50726f704578707446696c65')
              },
              Upload: {
                Data: new ObjectID('50726f7055706c6444617461')
              },
              Bundle: {
                BundleFile: new ObjectID('50726f7042756e6446696c65')
              }

            }
          }
        },

        Transactions: {

          States: {
            Pending: 1,
            Active: 2
          },

          // received from
          Signals: {
            Idle: 0, // no signal.
            Restart: 1, // restart the process.
            Cancel: 2, // cancel while handling message (will not be left on the queue)
            Shutdown: 3, // cancel and leave message intact (will be picked up again by another worker)
            Error: 4 // an error condition. produced locally, this signal will not be found in db documents.
          },

          Types: {
            Indexer: 1
          }

        },

        prometheus: {
          SANDBOX_CURRENT_EXECUTIONS_TOTAL: 'sandbox_current_executions_total',
          SANDBOX_IPC_MESSAGES_TOTAL: 'sandbox_ipc_messages_total',
          SANDBOX_EXECUTIONS_TOTAL: 'sandbox_total_executions_total',
          SANDBOX_EXECUTIONS_DURATION_SECONDS: 'sandbox_executions_duration_seconds',
          SANDBOX_EXECUTIONS_TIMEOUTS_TOTAL: 'sandbox_execution_timeouts_total',
          SANDBOX_EXECUTION_ERRORS_TOTAL: 'sandbox_execution_errors_total',
          TRIGGERS_EXECUTION_TOTAL: 'triggers_executions_total',
          TRIGGERS_BACKLOG_TOTAL: 'triggers_backlog_total',
          TRIGGERS_EXECUTION_DURATION_SECONDS: 'triggers_executions_duration_seconds',
          TRIGGERS_EXECUTION_LATENCY_SECONDS: 'triggers_executions_latency_seconds',
          ROUTES_EXECUTION_TOTAL: 'routes_executions_total',
          ROUTES_BACKLOG_TOTAL: 'routes_backlog_total',
          ROUTES_EXECUTION_DURATION_SECONDS: 'routes_executions_duration_seconds',
          ROUTES_EXECUTION_LATENCY_SECONDS: 'routes_executions_latency_seconds',
          LIBRARY_EXECUTION_TOTAL: 'library_executions_total',
          LIBRARY_BACKLOG_TOTAL: 'library_backlog_total',
          LIBRARY_EXECUTION_DURATION_SECONDS: 'library_executions_duration_seconds',
          LIBRARY_EXECUTION_LATENCY_SECONDS: 'library_executions_latency_seconds',
          JOBS_EXECUTION_TOTAL: 'jobs_executions_total',
          JOBS_BACKLOG_TOTAL: 'jobs_backlog_total',
          JOBS_EXECUTION_DURATION_SECONDS: 'jobs_executions_duration_seconds',
          JOBS_EXECUTION_LATENCY_SECONDS: 'jobs_executions_latency_seconds',
          metricType: {
            GAUGE: 1,
            HISTOGRAM: 2,
            COUNTER: 3,
            SUMMARY: 4
          }
        }
      }

consts.Transactions.StatesLookup = _.invert(consts.Transactions.States)
consts.Transactions.SignalsLookup = _.invert(consts.Transactions.Signals)

consts.LocationTypes.Min = consts.LocationTypes.File
consts.LocationTypes.Max = consts.LocationTypes.AwsS3

consts.NativeObjectsReverseLookup = _.invert(consts.NativeObjects)
consts.NativeObjectsArray = _.values(consts.NativeObjects)

consts.NativeIdsReverseLookup = _.invert(consts.NativeIds)
consts.NativeIdsArray = _.values(consts.NativeIds)
consts.NativeNamesArray = _.keys(consts.NativeIds)

consts.http.methodsLookup = _.invert(consts.http.methods)

// Notifications...

consts.Notifications = {}

consts.Notifications.Endpoints = {
  Email: {
    _id: new ObjectID('456e64706f696e7420456d6c'), // Endpoint Eml
    name: 'email',
    label: 'Email'
  },
  Sms: {
    _id: new ObjectID('456e64706f696e7420536d73'), // Endpoint Sms
    name: 'sms',
    label: 'SMS'
  },
  Push: {
    _id: new ObjectID('456e64706f696e7420507368'), // Endpoint Psh
    name: 'push',
    label: 'Push'
  }
}

consts.Notifications.States = {
  Enabled: 0,
  Disabled: 1,
  User: 2
}

consts.Notifications.InverseStates = _.invert(consts.Notifications.States)

consts.Notifications.Types = {

  LocationVerification: {
    _id: new ObjectID('4e66204c6f6361746e566572'), // Nf LocatnVer
    name: 'location-verification',
    label: 'Location Verification',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.Enabled,
      template: 'location-verification'
    }]
  },

  AccountActivation: {
    _id: new ObjectID('4e6620416363744163746976'), // Nf AcctActiv
    name: 'account-activation',
    label: 'Account Activation',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-activation'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'account-activation',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  AccountActivationProvider: {
    _id: new ObjectID('4e662041637441637450726f'), // Nf ActActPro
    name: 'account-activation-provider',
    label: 'Provider Account Activation',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.Enabled,
      template: 'account-activation-provider'
    }]
  },

  AccountAuthLocked: {
    _id: new ObjectID('4e6620417574684c636b6564'), // Nf AuthLcked
    name: 'account-auth-locked',
    label: 'Account Unauthorized Access Lock',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-auth-locked'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'account-auth-locked',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  ProviderVerificationProcessing: {
    _id: new ObjectID('4e662050726f765063736e67'), // Nf ProvPcsng
    name: 'account-provider-verification-processing',
    label: 'Provider Verification Processing',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-provider-verification-processing'
    }]
  },

  ProviderVerificationComplete: {
    _id: new ObjectID('4e662050726f76436d706c74'), // Nf ProvCmplt
    name: 'account-provider-verification-verified',
    label: 'Provider Verification Complete',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-provider-verification-verified'
    }]
  },

  AccountProvisioned: {
    _id: new ObjectID('4e6620416363745072767364'), // Nf AcctPrvsd
    name: 'account-provisioned',
    label: 'Account Provisioned',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-provisioned'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'account-provisioned',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  AccountWelcome: {
    _id: new ObjectID('4e662041637457656c636f6d'), // Nf ActWelcom
    name: 'account-welcome',
    label: 'Account Welcome',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  AccountWelcomeActivation: {
    _id: new ObjectID('4e662057656c636d41637476'), // Nf WelcmActv
    name: 'account-welcome-activation',
    label: 'Account Welcome with Activation',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome-activation'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome-activation',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  AccountWelcomeActivationProvider: {
    _id: new ObjectID('4e6620576d4163747650726f'), // Nf WmActvPro
    name: 'account-welcome-activation-provider',
    label: 'Account Welcome for Provider with Activation',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome-activation-provider'
    }]
  },

  AccountWelcomeProvider: {
    _id: new ObjectID('4e662057656c636d50726f76'), // Nf WelcmProv
    name: 'account-welcome-provider',
    label: 'Account Welcome for Provider',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome-provider'
    }]
  },

  AccountVerification: {
    _id: new ObjectID('4e6620416363745665726966'), // Nf AcctVerif
    name: 'account-welcome-verification',
    label: 'Account Verification',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome-verification'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'account-welcome-verification',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  AccountVerificationProvider: {
    _id: new ObjectID('4e662041637456726650726f'), // Nf ActVrfPro
    name: 'account-welcome-verification-provider',
    label: 'Account Verification for Provider',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.Enabled,
      template: 'account-welcome-verification-provider'
    }]
  },

  ConnectionCreated: {
    _id: new ObjectID('4e6620436e6e637443727464'), // Nf CnnctCrtd
    name: 'connection-created',
    label: 'Connection Created',
    duplicates: false,
    persists: true,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'connection-created'
    }, {
      _id: consts.Notifications.Endpoints.Push._id,
      state: consts.Notifications.States.User,
      template: 'connection'
    }]
  },

  GCMRegIdReassigned: {
    _id: new ObjectID('4e662047636d52654173676e'), // Nf GcmReAsgn
    name: 'gcm-regid-reassigned',
    label: 'GCM Registration Id Reassigned',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'gcm-regid-reassigned'
    }]
  },

  InviteExistingUser: {
    _id: new ObjectID('4e6620496e76457873746e67'), // Nf InvExstng
    name: 'invite-existing-user',
    label: 'Connection Invitation',
    duplicates: false,
    persists: true,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'invite-existing-user'
    }, {
      _id: consts.Notifications.Endpoints.Push._id,
      state: consts.Notifications.States.User,
      template: 'invitation'
    }]
  },

  InviteNewUser: {
    _id: new ObjectID('4e6620496e764e6577557372'), // Nf InvNewUsr
    name: 'invite-new-user',
    label: 'Invite New User',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.Enabled,
      template: 'invite-new-user'
    }]
  },

  IOSTokenReassigned: {
    _id: new ObjectID('4e6620496f7352654173676e'), // Nf IosReAsgn
    name: 'ios-token-reassigned',
    label: 'iOS Token Reassigned',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'ios-token-reassigned'
    }]
  },

  LostPassword: {
    _id: new ObjectID('4e66204c6f73745073737764'), // Nf LostPsswd
    name: 'lost-password',
    label: 'Lost Password',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'lost-password'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'lost-password',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  OrgInvitation: {
    _id: new ObjectID('4e6620496e765072764f7267'), // Nf InvPrvOrg
    name: 'org-invitation',
    label: 'Private Org Invitation',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'org-invitation'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'org-invitation',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  PasswordChangeNotification: {
    _id: new ObjectID('4e66204368616e6765507373'), // Nf ChangePss
    name: 'password-change-notification',
    label: 'Password Change',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'password-change-notification'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'password-change-notification',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  MobileChangeNotification: {
    _id: new ObjectID('4e66204368616e67654d6f62'), // Nf ChangeMob
    name: 'mobile-change-notification',
    label: 'Mobile change',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.User,
      template: 'mobile-change-notification'
    }, {
      _id: consts.Notifications.Endpoints.Sms._id,
      state: consts.Notifications.States.User,
      template: 'mobile-change-notification',
      defaultUserState: consts.Notifications.States.Disabled
    }]
  },

  FeedPostUpdate: {
    _id: new ObjectID('4e66204665656473506f7374'), // Nf FeedsPost
    name: 'feed-post-update',
    label: 'Feed Post Update',
    duplicates: false,
    persists: true,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Push._id,
      state: consts.Notifications.States.User,
      template: 'post-update'
    }]
  },

  FeedCommentUpdate: {
    _id: new ObjectID('4e66204665656473436d6e74'), // Nf FeedsCmnt
    name: 'feed-comment-update',
    label: 'Feed Comment Update',
    duplicates: false,
    persists: true,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Push._id,
      state: consts.Notifications.States.User,
      template: 'comment-update'
    }]
  },

  AdminAccountRegistrationNotification: {
    _id: new ObjectID('4e662041646d696e52656764'), // Nf AdminRegd
    name: 'admin-account-registration-notification',
    label: 'Account Registration Notification',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.Enabled
    }]
  },

  AdminProviderAccountVerificationRequired: {
    _id: new ObjectID('4e662041646d696e50726f56'), // Nf AdminProV
    name: 'admin-provider-verification-required-notification',
    label: 'Provider Account Verification Required',
    duplicates: false,
    persists: false,
    endpoints: [{
      _id: consts.Notifications.Endpoints.Email._id,
      state: consts.Notifications.States.Enabled
    }]
  }

}

consts.Notifications.TypeMap = Object.keys(consts.Notifications.Types).reduce(function(map, key) {
  map[consts.Notifications.Types[key]._id] = consts.Notifications.Types[key]
  return map
}, {})

consts.Notifications.EndpointMap = Object.keys(consts.Notifications.Endpoints).reduce(function(map, key) {
  map[consts.Notifications.Endpoints[key]._id] = consts.Notifications.Endpoints[key]
  return map
}, {})

// keys by id
consts.defaultRoles = {
  [consts.roles.admin]: {
    _id: consts.roles.admin,
    name: 'Administrator',
    code: 'administrator',
    include: [consts.roles.developer, consts.roles.support]
  },
  [consts.roles.developer]: {
    _id: consts.roles.developer,
    name: 'Developer',
    code: 'developer',
    include: []
  },
  [consts.roles.support]: {
    _id: consts.roles.support,
    name: 'Support',
    code: 'support',
    include: []
  },
  [consts.roles.provider]: {
    _id: consts.roles.provider,
    name: 'Provider',
    code: 'provider',
    include: []
  }
}

consts.defaultRoleIds = Object.values(consts.defaultRoles).map(v => v._id)

Object.freeze(consts.defaultRoles)
Object.freeze(consts.defaultRoleIds)

module.exports = consts
