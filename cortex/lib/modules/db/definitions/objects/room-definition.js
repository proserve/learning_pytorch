'use strict'

const Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      AccessPrincipal = require('../../../../access-principal'),
      consts = require('../../../../consts'),
      util = require('util'),
      _ = require('underscore'),
      twilioLib = require('twilio'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      { isSet, array: toArray, path: pathTo, promised, getIdOrNull, rInt, toJSON, equalIds, resolveOptionsCallback, sleep, timestampToId, idToTimestamp, createId, inIdArray, getIdArray, uniqueIdArray, findIdInArray } = require('../../../../utils'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      modules = require('../../../../modules'),
      { Driver } = modules.driver,
      MAX_ROOM_PARTICIPANTS = 50,
      MAX_SMALL_ROOM_PARTICIPANTS = 4,
      ROOM_STATS_MIN_AGE_MINS = 10, // don't check stats newer than these. this should be the provider room timeout plus a healthy margin.
      twilioInstances = {}

let Undefined

function twilio(region) {

  if (!twilioInstances[region]) {

    // selecting the client region does not seem to be working. sticking to mediaRegion for now.

    // const defaultRegion = config('televisit.twilio.availableRegions.0'),
    //       regionsConfig = config('televisit.twilio.allRegions'),
    //       selectedRegion = regionsConfig[region] ? region : defaultRegion,
    //       regionConfig = regionsConfig[selectedRegion],
    //       clientRegion = regionConfig.clientRegion || selectedRegion

    twilioInstances[region] = twilioLib(
      config('televisit.twilio.accountSid'),
      config('televisit.twilio.accountAuth')
      // {
      //   region: clientRegion
      // }
    )
  }
  return twilioInstances[region]

}

function RoomDefinition(options) {
  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(RoomDefinition, BuiltinContextModelDefinition)

RoomDefinition.prototype.generateMongooseSchema = function(options) {
  options = options || {}
  options.statics = RoomDefinition.statics
  options.methods = RoomDefinition.methods
  options.indexes = RoomDefinition.indexes
  options.options = { collection: RoomDefinition.collection }
  options.apiHooks = RoomDefinition.apiHooks
  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

RoomDefinition.collection = 'rooms'

RoomDefinition.prototype.aclWrite = function(ac, parentDocument, payload, options, callback) {

  [options, callback] = resolveOptionsCallback(options, callback)

  if (parentDocument.isNew && !isSet(parentDocument.mediaRegion)) {
    parentDocument.mediaRegion = ac.org.configuration.televisit.defaultRegion
  }

  BuiltinContextModelDefinition.prototype.aclWrite.call(this, ac, parentDocument, payload, options, callback)
}

RoomDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: true,
    hasOwner: true,
    _id: consts.NativeIds.room,
    objectLabel: 'Room',
    objectName: 'room',
    pluralName: 'rooms',
    collection: 'contexts',
    isExtensible: true,
    isVersioned: false,
    isDeletable: true,
    isUnmanaged: false,
    isFavoritable: false,
    auditing: {
      enabled: true,
      category: 'room'
    },
    obeyObjectMode: true,
    allowConnections: true,
    allowConnectionsOverride: true,
    allowConnectionOptionsOverride: true,
    allowBypassCreateAcl: true,
    createAclOverwrite: true,
    defaultAclOverride: true,
    shareChainOverride: true,
    shareAclOverride: true,
    shareChain: [acl.AccessLevels.Connected],
    createAcl: [],
    shareAcl: [],
    defaultAcl: [
      { type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }
    ],
    requiredAclPaths: ['remoteId', 'billingId', 'mediaRegion', 'state', 'configuration'],
    sequence: 1,
    properties: [
      {
        // remote unique identifier
        _id: consts.Properties.Ids.Room.Room,
        name: 'remoteId',
        label: 'Remote Identifier',
        type: 'String',
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System,
        writable: true,
        indexed: true,
        indexSlot: 0
      },
      {
        // StatLog insert identifier. the room stats worker will use this to calculate room usage.
        name: 'billingId',
        label: 'Billing Identifier',
        type: 'ObjectId',
        writable: true,
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System
      },
      {
        // is the room remotely closed. can be used to complete a room session. once deactivated, cannot be re-created.
        _id: consts.Properties.Ids.Room.State,
        name: 'state',
        label: 'State',
        type: 'String',
        default: 'new',
        writable: true,
        indexed: true,
        indexSlot: 1,
        validators: [
          {
            name: 'stringEnum',
            definition: {
              values: ['new', 'pending', 'open', 'closed']
            }
          },
          {
            name: 'adhoc',
            code: '',
            definition: {
              validator: function(ac, node, value) {

                const previousState = pathTo(this.$raw, 'state'),
                      { isNew } = ac.subject,
                      states = {

                        // new is only available on creation. the room will be automatically opened after creation.
                        // pending is only available on creation. the room will not be created.
                        new: () => isNew,
                        pending: () => isNew,

                        // a room can only be opened asynchronously by the system when created using the legacy 'new' state.
                        // a room can be opened by anyone that's in a pending state.
                        // a room can be opened synchronously on creation.
                        open: () => {

                          if (ac.subject.isNew) {
                            return true
                          } else if (previousState === 'new') {
                            return ac.hasAccess(acl.AccessLevels.System)
                          }
                          return previousState === 'pending'
                        },

                        // a room can always be closed.
                        closed: () => !isNew
                      }

                return states[value]()

              }
            }
          }
        ]
      },
      {
        label: 'Remote',
        name: 'remote',
        type: 'Any',
        virtual: true,
        optional: true,
        dependencies: ['mediaRegion', 'remoteId', 'state'],
        public: false,
        groupReader: function(node, principal, entries, req, script, selection, callback) {

          Promise.resolve(null)
            .then(async() => {

              for (const { input, output } of entries) {

                const { mediaRegion, remoteId, _id: subjectId, state } = input,
                      uniqueName = remoteId || subjectId.toString()

                output.remote = null

                if (state === 'open') {
                  try {
                    output.remote = _.pick(
                      (await twilio(mediaRegion).video.rooms(uniqueName).fetch()).toJSON(),
                      'status', 'endTime', 'duration', 'maxParticipants', 'mediaRegion', 'videoCodecs'
                    )
                  } catch (e) {
                    void e
                  }
                }

              }

            })
            .then(() => callback())
            .catch(err => callback(err))

        }
      },
      {
        label: 'Access Token',
        name: 'token',
        type: 'String',
        virtual: true,
        dependencies: ['configuration.openAt'],
        reader: function(ac) {

          const { AccessToken } = twilioLib.jwt,
                { VideoGrant } = AccessToken,
                openAt = pathTo(this, 'configuration.openAt'),
                token = new AccessToken(
                  config('televisit.twilio.accountSid'),
                  config('televisit.twilio.apiKey'),
                  config('televisit.twilio.authToken'),
                  {
                    identity: ac.principal._id.toString(),
                    nbf: _.isDate(openAt) ? parseInt((openAt.getTime() / 1000).toFixed(0)) : Undefined
                  }
                )

          token.addGrant(
            new VideoGrant({
              room: ac.subjectId.toString()
            })
          )

          return token.toJwt()

        }
      },
      {
        label: 'Region',
        name: 'mediaRegion',
        type: 'String',
        creatable: true,
        validators: [
          {
            name: 'required'
          },
          {
            name: 'adhoc',
            definition: {
              code: 'cortex.invalidArgument.enumValue',
              validator: function(ac, node, value) {
                return ac.org.configuration.televisit.availableRegions.includes(value)
              }
            }
          }
        ]
      },
      {
        label: 'Duration',
        name: 'duration',
        type: 'Number',
        writable: true,
        default: 0,
        writeAccess: acl.AccessLevels.System
      },
      {
        label: 'Configuration',
        name: 'configuration',
        type: 'Document',
        array: false,
        writable: true,
        properties: [
          {
            label: 'Enable Recording',
            name: 'enableRecording',
            type: 'Boolean',
            writable: true,
            default: false,
            writer: function(ac, node, value) {
              return !!value && ac.org.configuration.televisit.enableRecording
            }
          },
          {
            label: 'Open At',
            name: 'openAt',
            type: 'Date',
            default: null,
            writable: true,
            validators: [{
              name: 'date',
              definition: {
                allowNull: true
              }
            }]
          },
          {
            label: 'Synchronous Handling',
            name: 'synchronous',
            type: 'Boolean'
          },
          {
            label: 'Max Participants',
            name: 'maxParticipants',
            type: 'Number',
            default: 2,
            writable: true,
            validators: [
              {
                name: 'required'
              },
              {
                name: 'number',
                definition: {
                  min: 2,
                  max: MAX_ROOM_PARTICIPANTS,
                  allowNull: false,
                  allowDecimal: false
                }
              }
            ]
          }
        ]
      },
      {
        label: 'Events',
        name: 'events',
        type: 'List',
        sourceObject: 'roomevent',
        linkedReferences: [{
          source: '_id',
          target: 'roomId'
        }],
        inheritPropertyAccess: true,
        inheritInstanceRoles: true,
        readThrough: true,
        grant: acl.AccessLevels.Read,
        skipAcl: true
      },
      {
        label: 'Recordings',
        name: 'recordings',
        type: 'Document',
        array: true,
        writable: true,
        writeAccess: acl.AccessLevels.System,
        maxItems: -1,
        properties: [
          {
            _id: consts.Properties.Ids.Room.Recording,
            name: 'remoteId', // RecordingSid
            label: 'Remote Identifier',
            type: 'String',
            readAccess: acl.AccessLevels.System,
            writable: false,
            indexed: true,
            indexSlot: 2
          },
          {
            label: 'Account', // ParticipantIdentity
            name: 'account',
            type: 'ObjectId',
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Offset', // OffsetFromTwilioVideoEpoch
            name: 'offset',
            type: 'Number',
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Codec', // Codec
            name: 'codec',
            type: 'String',
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Container', // Container
            name: 'container',
            type: 'String',
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Duration', // Duration
            name: 'duration',
            type: 'Number',
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Track Name', // TrackName
            name: 'name',
            type: 'String',
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Track Type', // TrackType
            name: 'type',
            type: 'String',
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            _id: consts.Properties.Ids.Room.RawRecording,
            label: 'File',
            name: 'file',
            type: 'File',
            writable: true,
            writeAccess: acl.AccessLevels.System,
            processors: [{
              type: 'passthru',
              name: 'content',
              source: 'content',
              mimes: ['*'],
              allowUpload: true,
              passMimes: false,
              required: true
            }]
          }]
      },
      {
        // if recordings are ready and processed, or there are errors or no recordings at all.
        name: 'recordingsReady',
        type: 'Boolean',
        virtual: true,
        dependencies: ['state', 'compositions', 'participants', 'recordings', 'configuration.enableRecording', 'facets'],
        reader: function() {
          return recordingsReady(this)
        }
      },
      {
        label: 'Compositions',
        name: 'compositions',
        type: 'Document',
        array: true,
        maxItems: 10,
        canPush: true,
        canPull: true,
        writeOnCreate: true,
        writable: false,
        dependencies: ['configuration', 'compositions', 'recordingsReady', 'participants'],
        onValueAdded: function(ac, node, doc) {

          // setup reference and reserve an id
          if (!doc.composition) {
            doc.composition = {}
            doc.markModified('composition')
          }
          doc.composition._id = createId()
          doc.markModified('composition._id')

          ac.hook('save').after(
            function(vars, callback) {

              const { ac } = vars

              addRelatedCompositions(ac)
                .catch(err => {
                  logger.error(`room.save.after failed to add compositions for room ${ac.subjectId}.`, err.toJSON())
                })
                .then(() => callback())

            },
            'add-related-compositions',
            true
          )

          void 0
        },
        puller: function(ac, node, value) {

          if (getIdOrNull(value)) {

            const pulled = toArray(ac.option(`$pulled.${node.fqpp}`)),
                  doc = findIdInArray(this.compositions, '_id', value)

            if (doc && doc.composition && doc.composition._id) {

              if (!findIdInArray(pulled, '_id', value)) {
                pulled.push({ _id: value, compositionId: doc.composition._id })
                ac.option(`$pulled.${node.fqpp}`, pulled)
              }

              ac.hook('save').after(
                function(vars) {

                  if (vars.modified.includes('compositions')) {

                    const { subjectId, subject: { compositions = [] } } = ac,
                          removedCompositionIds = uniqueIdArray(toArray(ac.option(`$pulled.${node.fqpp}`))
                            .filter(doc => !findIdInArray(compositions, '_id', doc._id))
                            .map(v => v.compositionId))

                    removeRelatedCompositions(ac, removedCompositionIds)
                      .catch(err => {
                        logger.error(`room.save.after failed to delete compositions for room ${subjectId}.`, err.toJSON())
                      })

                  }

                },
                'remove-related-compositions',
                true
              )
            }

          }

          return value
        },
        properties: [
          {
            label: 'Label',
            name: 'label',
            type: 'String',
            writable: true,
            default: '',
            validators: [{
              name: 'string',
              definition: { allowNull: false, min: 0, max: 100 }
            }]
          },
          // non-writable composition. each pushed entry has a corollary Composition created.
          {
            label: 'Composition',
            name: 'composition',
            type: 'Reference',
            expandable: true,
            sourceObject: 'composition',
            inheritPropertyAccess: true,
            onCreateExpansion: function(ac, node, pointer) {
              // max access is read.
              pointer.grant = Math.min(pointer.grant, acl.AccessLevels.Read)
              return pointer
            }
          },
          {
            label: 'Layout',
            name: 'layout',
            type: 'String',
            creatable: true,
            default: config('composition.defaultLayout'),
            validators: [{
              name: 'required'
            }, {
              name: 'stringEnum',
              definition: {
                values: config('composition.layouts').slice()
              }
            }]
          },
          // participant accounts. if empty, uses all participant recordings. order determines layout.
          {
            label: 'Participants',
            name: 'participants',
            type: 'ObjectId',
            creatable: true,
            array: true,
            canPush: false,
            canPull: false,
            default: [],
            minItems: 0,
            maxItems: 50
          },
          {
            label: 'Background',
            name: 'background',
            type: 'String',
            creatable: true,
            uppercase: true,
            trim: true,
            default: config('composition.defaultBackground'),
            validators: [{
              name: 'required'
            }, {
              name: 'adhoc',
              definition: {
                validator: function(ac, node, value) {
                  return /[0-9A-F]{6}/g.test(value)
                }
              }
            }]
          },
          {
            label: 'Format',
            name: 'format',
            type: 'String',
            default: config('composition.defaultFormat'),
            creatable: true,
            validators: [{
              name: 'required'
            }, {
              name: 'stringEnum',
              definition: {
                values: config('composition.formats').map(v => v.mime)
              }
            }]
          },
          {
            label: 'Version',
            name: 'version',
            type: 'String',
            default: 'v1.20200731',
            creatable: true,
            validators: [{
              name: 'required'
            }, {
              name: 'stringEnum',
              definition: {
                values: ['v1.20200731']
              }
            }]
          },
          {
            label: 'Options',
            name: 'options',
            type: 'Document',
            array: true,
            minItems: 0,
            maxItems: 20,
            canPush: false,
            canPull: false,
            writeOnCreate: true,
            creatable: true,
            dependencies: ['.format'],
            properties: [
              {
                label: 'Key',
                name: 'key',
                type: 'String',
                creatable: true,
                validators: [{
                  name: 'required'
                }, {
                  name: 'adhoc',
                  definition: {
                    errCode: 'cortex.invalidArgument.enumValue',
                    validator: function(ac, node, value) {
                      const { options } = config('composition.formats').find(v => v.mime === this.parent().format) || {}
                      return options.find(v => v.key === value)
                    }
                  }
                }]
              },
              {
                label: 'Value',
                name: 'value',
                type: 'String',
                creatable: true,
                validators: [{
                  name: 'required'
                }, {
                  name: 'adhoc',
                  definition: {
                    errCode: 'cortex.invalidArgument.enumValue',
                    validator: function(ac, node, value) {
                      const { options } = config('composition.formats').find(v => v.mime === this.parent().format) || {},
                            { values } = options.find(v => v.key === this.key)

                      return values.includes(value)
                    }
                  }
                }]
              }

            ]
          }
        ]
      },
      {
        label: 'Participants',
        name: 'participants',
        type: 'Document',
        array: true,
        writeAccess: acl.AccessLevels.System,
        canPush: true,
        canPull: true,
        maxItems: -1,
        properties: [
          {
            // remote participant identifier
            name: 'remoteId',
            label: 'Remote Identifier',
            type: 'String',
            readAccess: acl.AccessLevels.System,
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Account',
            name: 'account',
            type: 'Reference',
            writeAccess: acl.AccessLevels.System,
            writable: true,
            sourceObject: 'account',
            grant: acl.AccessLevels.Public,
            expandable: true,
            pacl: [{
              type: acl.AccessTargets.Account,
              target: acl.PublicIdentifier,
              allow: acl.AccessLevels.Read,
              paths: ['name']
            }],
            validators: [
              {
                name: 'uniqueInArray'
              }
            ]
          },
          {
            label: 'Status',
            name: 'status',
            type: 'String',
            writeAccess: acl.AccessLevels.System,
            writable: true,
            validators: [
              {
                name: 'stringEnum',
                definition: {
                  values: ['connected', 'disconnected']
                }
              }
            ]
          },
          {
            label: 'Audio',
            name: 'audio',
            type: 'String',
            writeAccess: acl.AccessLevels.System,
            uniqueValues: true,
            writable: true,
            canPush: false,
            canPull: false,
            array: true,
            validators: [
              {
                name: 'stringEnum',
                definition: {
                  values: ['connected', 'paused']
                }
              }
            ]
          },
          {
            label: 'Video',
            name: 'video',
            type: 'String',
            writeAccess: acl.AccessLevels.System,
            uniqueValues: true,
            writable: true,
            array: true,
            canPush: false,
            canPull: false,
            validators: [
              {
                name: 'stringEnum',
                definition: {
                  values: ['connected', 'paused']
                }
              }
            ]
          }
        ]
      }
    ]
  }
}

// shared methods --------------------------------------------------------

RoomDefinition.methods = {

}

// shared statics --------------------------------------------------------

RoomDefinition.statics = {

  aclInit: function() {

  },

  updateBillingRecord: async function(orgId, roomId, doc) {

    try {

      const result = await promised(
        modules.db.models.statlog,
        'op',
        consts.operations.codes.roomCreated,
        orgId,
        this.objectName,
        roomId.toString(),
        {
          roomId
        },
        doc
      )

      return pathTo(result, 'upsertedIds.0')

    } catch (err) {

      logger.error(`billing tracking failed to start for room ${roomId}`)
      throw err

    }

  },

  processBillingRecords: function(options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const StatLog = modules.db.models.StatLog,
          Stat = modules.db.models.Stat,
          request = {
            cancel: () => {
              this.cancelled = true
            }
          }

    Promise.resolve(null)
      .then(async() => {

        // pick the last one we'll load so we don't end up looping forever.
        // also, only look at rooms older than the room timeout. rooms that never receive connections aren't actually
        // created at the provider level.

        let lastId = consts.emptyId

        while (1) {

          if (request.cancelled) {
            throw Fault.create('cortex.error.aborted')
          }

          const match = {
                  _id: {
                    $gt: lastId
                  },
                  code: consts.operations.codes.roomCreated,
                  $or: [{
                    // hint the room was completed. if this does no exist at the provider, it logged 0 secs
                    'is.completed': true
                  }, {
                    _id: {
                      // rooms older than this will either have timed out or are still running. if they don't exist
                      // at the provider, consider them 0 mins. if they do, their status will likely be running.
                      $lte: timestampToId(new Date(Date.now() - (ROOM_STATS_MIN_AGE_MINS * (60 * 1000))))
                    }
                  }]
                },
                doc = (await StatLog.collection.find(match).limit(1).sort({ _id: 1 }).toArray())[0]

          if (!doc) {
            break
          }

          lastId = doc._id

          let room,
              count = 0,
              duration = 0,
              starting,
              ending,
              ended,
              code = consts.stats.sources.roomUsage

          try {

            let mediaRegion = config('televisit.twilio.availableRegions')[0]
            try {
              const org = await modules.models.db.org.loadOrg(doc.org)
              mediaRegion = org.configuration.televisit.defaultRegion
            } catch (err) {
              void err
            }

            // Twilio does NOT index by unique name (subjectId) when the room is completed so we only
            // have the remoteId on which to rely.
            const uniqueName = doc.is.remoteId || doc.was.roomId.toString()
            room = await twilio(mediaRegion).video.rooms(uniqueName).fetch()

          } catch (err) {

            // room not found is normal.
            if (err.code !== 20404) {
              // failed to retrieve the room. track the error in cortex and skip the log entry.
              logger.warn('[Room.processBillingRecords] error loading room for billing. could not calculate billing data', doc)
            }

          }

          if (room) {

            // use the period for when the room started, which would be the billing record
            if (room.status === 'in-progress') {

              continue

            } else if (room.status === 'completed') {

              ended = room.endTime
              duration += rInt(room.duration, 0)

            }

            count += 1

          } else {

            // room doesn't exist at twilio, consider it 0 duration (out match only looks for records older than
            // a room could possibly be without having timed out.
            count += 1

          }

          if (!ended) {
            ended = idToTimestamp(doc._id)
          }

          // set the stats period to when the room completed. televisit stats recorded by the hour.
          starting = new Date(ended)
          starting.setMinutes(0, 0, 0)

          ending = new Date(starting.getTime())
          ending.setMinutes(59, 59, 999)

          await Stat.collection.updateOne(
            {
              org: doc.org,
              starting,
              ending,
              code
            },
            {
              $setOnInsert: {
                org: doc.org,
                starting,
                ending,
                code
              },
              $inc: {
                count,
                duration
              }
            },
            { writeConcern: { w: 'majority' } }
          )
          await StatLog.collection.deleteOne({ _id: doc._id }, { writeConcern: { w: 'majority' } })

          await sleep(100)

        }

      })
      .then(v => callback(null, v))
      .catch(callback)

    return request

  },

  closeRoom: async function(ac) {

    const { subject, subjectId, orgId } = ac,
          { remoteId } = subject,
          uniqueName = remoteId || subjectId.toString()

    try {
      await twilio(subject.mediaRegion).video.rooms(uniqueName).update({ status: 'completed' })
    } catch (err) {
      modules.db.models.Log.logApiErr(
        'api',
        err,
        ac,
        null,
        {
          operation: 'Room.closeRoom()',
          roomId: subjectId
        }
      )
    }

    try {
      await this.updateBillingRecord(orgId, subjectId, { remoteId, completed: true })
    } catch (err) {
      void 0
    }

  },
  openRoom: async function(ac) {

    if (!pathTo(ac.org, 'configuration.televisit.roomsEnabled')) {
      throw Fault.create('cortex.accessDenied.roomsDisabled', { resource: ac.getResource() })
    }

    const { principal, subject } = ac,
          count = await promised(
            this,
            'aclCount',
            AccessPrincipal.synthesizeAccount({ org: principal.org, accountId: acl.AnonymousIdentifier }),
            {
              scoped: false,
              skipAcl: true,
              where: {
                state: { $in: ['open'] }
              }
            }
          ),
          max = rInt(pathTo(principal.org, 'configuration.televisit.maxConcurrentRooms'), 1)

    if (count >= max) {

      throw Fault.create('cortex.accessDenied.maxRooms', { resource: ac.getResource() })

    } else {

      const { org } = principal,
            { _id: orgId } = org,
            { configuration, mediaRegion, _id: subjectId } = subject,
            { enableRecording, maxParticipants } = configuration,
            environment = principal.org.code,
            type = maxParticipants <= MAX_SMALL_ROOM_PARTICIPANTS ? 'group-small' : 'group',
            statusCallback = config('televisit.debugRelay.client.enabled')
              ? `https://${config('televisit.debugRelay.client.endpoint')}/medable/v2/integrations/twilio/video/relay/${config('televisit.debugRelay.client.name')}/${environment}`
              : `https://${config('server.apiHost')}/medable/v2/integrations/twilio/video/callback/${environment}`,
            roomOptions = {
              type,
              recordParticipantsOnConnect: enableRecording,
              uniqueName: subjectId.toString(), // ObjectId does not serialize well.
              maxParticipants,
              mediaRegion,
              statusCallback,
              statusCallbackMethod: 'POST'
            },

            billingId = await this.updateBillingRecord(orgId, subjectId, { completed: false }),
            room = await twilio(subject.mediaRegion).video.rooms.create(roomOptions),
            { sid: remoteId } = room

      await this.updateBillingRecord(orgId, subjectId, { remoteId, completed: false })

      return { room, billingId }

    }

  },

  processTwilioEvent: async function(org, event = {}) {

    const eventTypes = {

            room: {
              names: 'room-created room-ended'.split(' '),
              handle: async(ac, name) => {

                const state = {

                  // the room is ready for consumers.
                  created: 'open',

                  // the room closed by either setting the values or remotely due to a timeout.
                  ended: 'closed'

                }[name]

                if (state) {

                  const update = { state }
                  if (name === 'ended') {
                    update.duration = rInt(parseFloat(event.RoomDuration), 0)
                  }

                  try {
                    await promised(this, 'aclUpdate', ac.principal, ac.subjectId, update, {
                      method: 'put',
                      grant: acl.AccessLevels.System,
                      disableTriggers: true
                    })
                  } catch (err) {
                    logger.error(`processTwilioEvent failed to update room state for ${ac.subjectId}`, err.toJSON())
                  }

                }

              },
              log: (name) => {
                const log = {}
                if (name === 'ended') {
                  log.duration = rInt(parseFloat(event.RoomDuration), 0)
                }
                return log

              }
            },

            participant: {
              names: 'participant-connected participant-disconnected'.split(' '),
              paths: ['participants'],
              handle: async(ac, name, event, log) => {
                return updateParticipants(
                  ac,
                  { event, log, where: { name: { $in: ['connected', 'disconnected'] } } },
                  participant => {
                    participant.status = name
                  }
                )
              },
              log: (name) => {
                const log = {
                  status: event.ParticipantStatus
                }
                if (name === 'disconnected') {
                  log.duration = parseFloat(event.ParticipantDuration)
                }
                return log
              }
            },

            track: {
              names: 'track-added track-removed track-enabled track-disabled'.split(' '),
              handle: async(ac, name, event, log) => {

                const { trackKind } = log,
                      addedRemoved = ['added', 'removed'],
                      enabledDisabled = ['enabled', 'disabled'],
                      isConnect = addedRemoved.includes(name),
                      isPause = !isConnect,
                      activeVerb = isConnect ? 'connected' : 'paused',
                      search = isConnect ? addedRemoved : enabledDisabled

                return updateParticipants(
                  ac,
                  { event, log, where: { name: { $in: search }, trackKind } },
                  (participant, from) => {

                    const status = _.without(
                      toArray(from && from[trackKind]),
                      activeVerb
                    )
                    if ((isConnect && name === 'added') || (isPause && name === 'disabled')) {
                      status.push(activeVerb)
                    }
                    participant[trackKind] = status
                  }
                )
              },
              log: () => ({
                status: event.ParticipantStatus,
                trackName: event.TrackName,
                trackKind: event.TrackKind
              })
            },

            recording: {
              names: 'recording-started recording-completed recording-failed'.split(' '),
              handle: async(ac, name) => {

                let addedFacetArgs

                // handle contention
                await sequencedUpdateRoom(ac, async(ac, room) => {

                  const {
                          RecordingSid,
                          Size,
                          Container,
                          Codec,
                          ParticipantIdentity,
                          Duration,
                          TrackName,
                          OffsetFromTwilioVideoEpoch,
                          FailedOperation
                        } = event,
                        Type = Container === 'mkv' ? 'video' : 'audio'

                  let recording = room.recordings.find(v => v.remoteId === RecordingSid),
                      recordingId = recording && recording._id,
                      facet

                  if (!recording) {

                    facet = {
                      pid: createId(),
                      creator: ac.principal._id,
                      private: false,
                      name: 'content',
                      mime: `${Type}/x-matroska`, // audio, video
                      _pi: consts.Properties.Ids.Room.RawRecording,
                      _kl: false,
                      _up: new Date(),
                      filename: `${RecordingSid}.${Container}`,
                      meta: [{
                        name: 'awsId',
                        value: `twilio-video-recordings/${RecordingSid}.${Container}`, // leave it there. @todo add the
                        pub: false
                      }],
                      location: consts.LocationTypes.AwsS3,
                      storageId: 'medable'
                    }

                    recordingId = createId()
                    room.recordings.push({
                      _id: recordingId,
                      remoteId: RecordingSid,
                      account: getIdOrNull(ParticipantIdentity),
                      offset: parseInt(OffsetFromTwilioVideoEpoch),
                      codec: Codec,
                      container: Container,
                      name: TrackName,
                      type: Type,
                      file: {
                        creator: ac.principal._id,
                        facets: [facet.pid],
                        sources: []
                      }
                    })

                    recording = room.recordings.find(v => equalIds(v._id, recordingId))

                    room.facets.push(facet)

                  }

                  facet = room.facets.find(v => equalIds(v.pid, recording.file.facets[0]))

                  switch (name) {

                    case 'started': {

                      if (!isSet(facet.state)) { // might have come in out of order. don't 'un-ready'
                        facet.state = consts.media.states.pending
                      }
                      break
                    }

                    case 'completed': {

                      recording.duration = parseInt(Duration)
                      recording.offset = OffsetFromTwilioVideoEpoch
                      facet.state = consts.media.states.ready
                      facet.size = parseInt(Size)

                      const { size, _pi } = facet,
                            { object, type } = room,
                            { Stat } = modules.db.models

                      addedFacetArgs = [ac.orgId, Stat.getDocumentSource(room), object, type, _pi, 1, size]
                      break
                    }

                    case 'failed': {

                      facet.state = consts.media.states.error
                      facet.fault = Fault.create('cortex.error.unspecified', { reason: FailedOperation }).toJSON()
                      break
                    }

                  }

                  room.markModified('facets')

                })

                // don't accidentally add these twice.
                if (addedFacetArgs) {
                  modules.db.models.Stat.addRemoveFacet(...addedFacetArgs)
                }

              },

              log: () => ({})

            },

            composition: {
              names: 'composition-started composition-available composition-progress composition-failed'.split(' '),
              handle: async() => {

              },
              log: () => ({})
            }

          },
          timestamp = new Date(event.Timestamp),
          [type, name] = event.StatusCallbackEvent.split('-'),
          eventType = eventTypes[type],
          principal = AccessPrincipal.synthesizeAccount({ org, accountId: acl.AnonymousIdentifier }),
          order = rInt(event.SequenceNumber, 0),
          accountId = getIdOrNull(event.ParticipantIdentity) || Undefined,
          isPossibleReadyEvent = ['room-ended', 'recording-completed'].includes(event.StatusCallbackEvent),
          afterTriggerExists = await promised(modules.sandbox, 'triggerExists', principal, this, `${type}.after`),
          readyTriggerExists = isPossibleReadyEvent && await promised(modules.sandbox, 'triggerExists', principal, this, `recordings.ready.after`),
          readOpts = {
            grant: acl.AccessLevels.System,
            allowNullSubject: true,
            throwNotFound: false,
            json: false,
            paths: (afterTriggerExists || isPossibleReadyEvent) ? null : ['_id'],
            include: (eventType && eventType.paths) || ['_id']
          }

    let roomId, room

    switch (type) {

      case 'room':
      case 'participant':
      case 'track':
      case 'recording':

        roomId = getIdOrNull(event.RoomName)
        readOpts.where = { _id: roomId }
        room = await promised(this, 'aclReadOne', principal, null, readOpts)

        break

      case 'composition': {

        readOpts.where = { 'recordings.remoteId': getIdOrNull(event.CompositionSid) }
        room = await promised(this, 'aclReadOne', principal, null, readOpts)
        roomId = pathTo(room, '_id')

        break
      }

    }

    if (room) {

      const RoomEvent = modules.db.models.RoomEvent,
            log = {
              type,
              name,
              order,
              roomId,
              accountId,
              ...(eventType.log(name))
            },
            createOptions = {
              bypassCreateAcl: true,
              skipAcl: true,
              grant: acl.AccessLevels.System,
              ignoreObjectMode: true,
              forceAllowCreate: true,
              scoped: false,
              beforeWrite: (ac, payload, callback) => {
                ac.subject.created = timestamp
                callback()
              }
            },
            eventAc = new acl.AccessContext(principal, room, { grant: acl.AccessLevels.Read })

      try {
        await promised(RoomEvent, 'aclCreate', principal, log, createOptions)
      } catch (err) {
        logger.error('Error recording room event', toJSON(err))
      }

      try {

        if (eventType.handle) {
          await eventType.handle(eventAc, name, event, log)
        }

      } catch (err) {

        modules.db.models.Log.logApiErr(
          'api',
          Fault.from(err),
          eventAc,
          null,
          log
        )
        if (config('__is_mocha_test__')) {
          require('../../../../../test/lib/server').events.emit('twilio.event', Fault.from(err))
        }
      }

      if (afterTriggerExists || isPossibleReadyEvent) {

        // reload the room so the triggers have the latest version.
        room = (await promised(this, 'aclReadOne', principal, null, { ...readOpts, grant: acl.AccessLevels.Script }))
      }

      if (afterTriggerExists) {
        try {
          await promised(modules.sandbox, 'triggerScript', `${type}.after`, null, eventAc, { attachedSubject: room }, { event: log })
        } catch (e) {
          void e
        }
      }

      if (isPossibleReadyEvent) {

        const ready = recordingsReady(room)

        if (ready) {

          eventAc.subject = room

          await addRelatedCompositions(eventAc)

          if (readyTriggerExists) {

            try {
              await promised(modules.sandbox, 'triggerScript', 'recordings.ready.after', null, eventAc, { attachedSubject: room }, { event: log })
            } catch (e) {
              void e
            }

          }

        }

      }

      if (config('__is_mocha_test__')) {
        require('../../../../test/lib/server').events.emit('twilio.event', null)
      }
    } else {

      const err = Fault.create('cortex.notFound.instance', { reason: `Room event ${type}-${name} could not be processed because the originating room does not exist.`, resource: `room.${roomId || '?'}` })
      modules.db.models.Log.logApiErr(
        'api',
        err,
        new acl.AccessContext(AccessPrincipal.synthesizeAnonymous(org)),
        null,
        {
          roomId
        }
      )

      if (config('__is_mocha_test__')) {
        require('../../../../test/lib/server').events.emit('twilio.event', Fault.from(err))
      }

    }

  }

}

// indexes ---------------------------------------------------------------

RoomDefinition.indexes = [ ]

// shared hooks  ---------------------------------------------------------

RoomDefinition.apiHooks = [

  {
    name: 'create',
    before: function(vars, callback) {

      // write state to the room to trigger the index update (the default won't trigger the index update)
      // also, set synchronous state to matching value. this will determine the room open/close behaviour
      // when setting the state.
      const { ac } = vars,
            { subject } = ac,
            { state } = subject

      subject.aclWrite(ac, { state }, err => {
        if (!err) {
          subject.configuration.synchronous = ['pending', 'open'].includes(state)
        }
        callback(err)
      })

    }
  },

  {
    name: 'save',
    async before(vars, callback) {

      let err

      // the room is opened synchronously if the caller chose the open state on create.
      const { ac } = vars,
            { subject } = ac,
            { state, configuration: { synchronous }, isNew } = subject,
            previousState = pathTo(subject.$raw, 'state')

      try {
        if (synchronous && state !== previousState) {
          if (state === 'open' && (isNew || previousState === 'pending')) {
            const { room: { sid: remoteId }, billingId } = await this.openRoom(ac),
                  updateContext = new acl.AccessContext(ac.principal, subject, { method: 'put', grant: acl.AccessLevels.System })
            await promised(subject, 'aclWrite', updateContext, { remoteId, billingId })
          } else if (state === 'closed' && previousState === 'open') {
            await this.closeRoom(ac)
          }
        }
      } catch (e) {
        err = e
      }

      callback(err)

    }
  },
  {
    name: 'create',
    async after(vars, callback) {

      callback()

      const { ac } = vars,
            { principal, subject } = ac,
            { state, _id: subjectId, configuration: { synchronous } } = subject

      // attempt to open the room in async mode when "new", out of band.
      if (!synchronous && state === 'new') {

        try {
          const { room: { sid: remoteId }, billingId } = await this.openRoom(ac)
          await promised(this, 'aclUpdate', principal, subjectId, { remoteId, billingId }, { method: 'put', grant: acl.AccessLevels.System, disableTriggers: true })
        } catch (e) {
          const err = Fault.from(e, false, true)
          err.resource = `room.${subject._id}`
          modules.db.models.Log.logApiErr('api', err, ac, null, { roomId: subject._id })
        }

      }
    }

  },
  {
    name: 'update',
    async after(vars, callback) {

      callback()

      const { ac } = vars,
            { subject, subjectId } = ac,
            { state, configuration: { synchronous } } = subject,
            previousState = pathTo(subject.$raw, 'state')

      if (!synchronous && state !== previousState) {
        if (state === 'closed') {
          if (['new', 'open'].includes(previousState)) {
            try {
              await this.closeRoom(ac)
            } catch (err) {
              if (previousState === 'open') {
                logger.error(`update.after failed to close room ${subjectId}.`, err.toJSON())
              }
            }
          }
        }
      }

    }
  },
  {
    name: 'delete',
    async before(vars, callback) {

      const { ac } = vars,
            { subject, subjectId } = ac,
            { state, configuration: { synchronous } } = subject

      if (synchronous && state === 'open') {
        try {
          await this.closeRoom(ac)
        } catch (err) {
          logger.error(`delete.before failed to close room ${subjectId}.`, err.toJSON())
        }
      }
      callback()

    },
    async after(vars, callback) {

      callback()

      const { ac } = vars,
            { subject, subjectId } = ac,
            { state, configuration: { synchronous }, compositions } = subject,
            compositionIds = getIdArray(toArray(compositions).map(v => pathTo(v, 'composition._id')))

      // delete all associated compositions.
      removeRelatedCompositions(ac, compositionIds)
        .catch(err => {
          logger.error(`room.delete.after failed to delete compositions for room ${subjectId}.`, err.toJSON())
        })

      if (!synchronous && ['new', 'open'].includes(state)) {
        try {
          await this.closeRoom(ac)
        } catch (err) {
          if (state === 'open') {
            logger.error(`room.delete.after failed to close room ${subjectId}.`, err.toJSON())
          }
        }
      }

    }
  }
]

async function removeRelatedCompositions(ac, compositionIds) {

  if (compositionIds.length) {

    const { principal, req, script } = ac,
          { db: { models: { Composition } } } = modules,
          driver = new Driver(principal, Composition, { req, script })

    return driver.executeOperation('deleteMany', { match: { _id: { $in: compositionIds } } }, { parent: req && req.operation, skipAcl: true, grant: acl.AccessLevels.System })
      .then(deletedCount => {
        logger.silly(`room.delete.after deleted ${deletedCount} related compositions.`)
      })

  }

}

function recordingsReady(room) {

  const { configuration: { enableRecording }, state, recordings, facets } = room,
        recordingPids = toArray(recordings).reduce((pids, recording) => pids.concat(recording.file.facets[0]), []),
        recordingFacets = facets.filter(facet => inIdArray(recordingPids, facet.pid)),
        facetsReady = recordingFacets.every(facet => [consts.media.states.ready, consts.media.states.error].includes(facet.state)),
        hasRecordings = recordingPids.length > 0

  return state === 'closed' && enableRecording && hasRecordings && facetsReady

}

async function addRelatedCompositions(ac) {

  const { subject: room, principal, req, script, subjectId, object } = ac,
        { compositions = [] } = room,
        ready = recordingsReady(room)

  if (ready && compositions.length) {

    const { db: { models: { Composition } } } = modules,
          fileNode = object.schema.node.findNode('recordings.file'),
          urlExpirySeconds = 86400 * 10,
          docs = []

    for (const composition of compositions) {

      let err = null

      const participants = [],
            format = config('composition.formats').find(v => v.mime === composition.format) || config('composition.formats').find(v => v.extension === 'mp4'),
            codecOpts = format.options.map(option => {

              const existing = composition.options.find(v => v.key === option.key)
              return `${option.key} ${existing ? existing.value : option.default}`.trim()

            })

      for (const accountId of (composition.participants.length === 0 ? room.participants.map(v => v.account && v.account._id).filter(v => v) : composition.participants)) {

        const video = [],
              audio = []

        for (const recording of room.recordings) {

          if (equalIds(recording.account, accountId)) {
            const facet = findIdInArray(room.facets, 'pid', recording.file && recording.file.facets[0])
            if (facet) {
              const pointer = modules.storage.create(fileNode, facet, ac)
              if (pointer) {
                if (facet.state === consts.media.states.ready) {
                  try {

                    const url = await promised(pointer, 'url', { urlExpirySeconds }),
                          array = recording.type === 'audio' ? audio : video
                    array.push(url)

                  } catch (e) {
                    void e
                  }

                }
              }
            }
          }

        }

        if (video.length > 0 || audio.length > 0) {
          participants.push({ id: accountId, video, audio })
        }

      }

      if (!participants.length) {
        err = Fault.create('cortex.error.unspecified', { reason: 'There were no available recordings.' })
      }

      docs.push({
        _id: composition.composition._id,
        context: {
          object: 'room',
          _id: subjectId
        },
        format: composition.format,
        state: err ? 'error' : 'queued',
        err,
        definition: {
          participants,
          videoBg: composition.background,
          layout: composition.layout,
          format: format.extension,
          file: `${composition.composition._id}.${format.extension}`,
          debug: config('composition.debug'),
          codecOpts
        }
      })

    }

    let result = await promised(
      Composition,
      'aclCreateMany',
      principal,
      docs,
      {
        req,
        script,
        forceAllowCreate: true,
        bypassCreateAcl: true,
        grant: acl.AccessLevels.System,
        beforeWrite: ({ subject }, payload, callback) => {

          subject._id = payload._id // set reserved object id
          delete payload._id
          callback()

        }
      })

    if (result.writeErrors.length) {
      // @todo log writeErrors that aren't duplicate key errors.
    }

  }

}

/**
 * sequenced update for room. return false from update function to cancel. save
 * @param ac
 * @param fnUpdate
 * @returns {Promise<Promise<*>|*>}
 */
async function sequencedUpdateRoom(ac, fnUpdate) {

  return promised(
    modules.db,
    'sequencedFunction',
    callback => {

      // get the latest event, load the room and update the participants list
      Promise.resolve(null)
        .then(async() => {
          return promised(ac.object, 'aclReadOne', ac.principal, ac.subjectId, { json: false, grant: acl.AccessLevels.System })
        })
        .then(async room => {
          if (room) {

            const updateContext = new acl.AccessContext(ac.principal, room, { grant: acl.AccessLevels.System }),
                  result = await fnUpdate(updateContext, room)

            if (result !== false) {
              await promised(updateContext, 'lowLevelUpdate')
            }

          }
        })
        .then(() => callback())
        .catch(err => callback(err))

    },
    20
  )

}

async function updateParticipants(ac, { event = {}, log = {}, where = {} } = {}, fnUpdate) {

  return promised(
    modules.db,
    'sequencedFunction',
    callback => {

      // get the latest event, load the room and update the participants list
      getLatestEvent(ac, { event, log, where })
        .then(async latest => {
          if (latest) {
            return promised(ac.object, 'aclReadOne', ac.principal, ac.subjectId, { json: false, grant: acl.AccessLevels.System, paths: ['participants'] })
          }
        })
        .then(async room => {
          if (room) {

            const { accountId } = log,
                  { participants = [] } = room,
                  participant = participants.find(participant => equalIds(participant.account._id, accountId)),
                  updateContext = new acl.AccessContext(ac.principal, room, { grant: acl.AccessLevels.System }),
                  writeOptions = { mergeDocuments: true },
                  update = { participants: [{}] }

            if (participant) {
              update.participants[0]._id = participant._id
            } else {
              update.participants[0].account = accountId
            }

            fnUpdate(update.participants[0], participant)

            // write the changes and update
            await promised(room, 'aclWrite', updateContext, update, writeOptions)
            return promised(updateContext, 'lowLevelUpdate')
          }
        })
        .then(() => callback())
        .catch(err => callback(err))

    },
    20
  )

}

async function getLatestEvent(ac, { event = {}, log = {}, where = {} } = {}) {

  const { principal, subjectId: roomId } = ac,
        { RoomEvent } = modules.db.models,
        { type } = log

  return new Driver(principal, RoomEvent).readOne(
    {
      where: {
        roomId,
        type,
        ...where
      },
      sort: {
        order: -1
      },
      throwNotFound: false
    },
    {
      skipAcl: true,
      grant: 'read'
    },
    {
      allowUnindexed: true
    }
  )

}

// exports --------------------------------------------------------

module.exports = RoomDefinition
