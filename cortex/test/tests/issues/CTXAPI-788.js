'use strict'

const should = require('should'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      { flatten } = require('lodash')

describe('Issues - CTXAPI-788 sequenceError on twilio events', function() {

  let participants, room
  before(async() => {
    const code = function() {
            const participants = [
                    org.objects.accounts.register({
                      'name': {
                        'first': 'participant',
                        'last': 'doctor'
                      },
                      'email': 'participant+doctor@medable.com',
                      'password': 'qpal1010'
                    }, {
                      skipVerification: true,
                      skipActivation: true,
                      skipNotification: true,
                      requireMobile: false
                    }),
                    org.objects.accounts.register({
                      'name': {
                        'first': 'participant',
                        'last': 'patient'
                      },
                      'email': 'participant+patient@medable.com',
                      'password': 'qpal1010'
                    }, {
                      skipVerification: true,
                      skipActivation: true,
                      skipNotification: true,
                      requireMobile: false
                    })
                  ],
                  room = org.objects.rooms.insertOne({
                    acl: [
                      'account.public.read'
                    ],
                    configuration: {
                      maxParticipants: 2,
                      enableRecording: true
                    },
                    compositions: [{ label: 'Meeting.' }]
                  })
                    .bypassCreateAcl()
                    .lean(false)
                    .include('live')
                    .execute()
            return { participants, room }
          },
          codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
          scriptLoad = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' },
          result = await server.sessions.admin
            .post(server.makeEndpoint('/sys/script_runner'))
            .set(server.getSessionHeaders())
            .send(scriptLoad)
            .then()
    /* global org */
    // create participants
    participants = result.body.data.participants
    room = result.body.data.room
  })

  after(sandboxed(function() {
    org.objects.accounts.deleteOne({ email: 'participant+doctor@medable.com' }).skipAcl().grant(8).execute()
    org.objects.accounts.deleteOne({ email: 'participant+patient@medable.com' }).skipAcl().grant(8).execute()
  }))

  it('should not trigger sequence error if many concurrent webhook calls happens', async() => {
    let err = null
    const agent = supertest.agent(server.api.expressApp),
          participantPayLoad = function(participantId, room, numberOfTracks = 2) {
            const tracks = [...Array(numberOfTracks).keys()].map((e) => {
              const event = e % 2 === 0 ? 'track-added' : 'track-enabled'
              return [
                agent.post('/medable/v2/integrations/twilio/video/callback/test-org')
                  .set('Content-Type', 'application/x-www-form-urlencoded')
                  .send({
                    StatusCallbackEvent: event,
                    ParticipantStatus: 'connected',
                    Timestamp: new Date().getTime(),
                    SequenceNumber: e + 1,
                    ParticipantIdentity: participantId,
                    RoomName: room._id,
                    trackName: `track${e + 1}`,
                    TrackKind: 'video'
                  }),
                agent.post('/medable/v2/integrations/twilio/video/callback/test-org')
                  .set('Content-Type', 'application/x-www-form-urlencoded')
                  .send({
                    StatusCallbackEvent: event,
                    ParticipantStatus: 'connected',
                    Timestamp: new Date().getTime(),
                    SequenceNumber: e + 2,
                    ParticipantIdentity: participantId,
                    RoomName: room._id,
                    trackName: `track${e + 1}`,
                    TrackKind: 'audio'
                  })
              ]
            })
            return [
              agent.post('/medable/v2/integrations/twilio/video/callback/test-org')
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send({
                  StatusCallbackEvent: 'participant-connected',
                  ParticipantStatus: 'connected',
                  Timestamp: new Date().getTime(),
                  SequenceNumber: 0,
                  ParticipantIdentity: participantId,
                  RoomName: room._id
                }),
              ...flatten(tracks)
            ]
          },

          start = new Date().getTime(),
          handler = function(e) {
            err = e
            server.events.removeEventListener('twilio.event', handler)
          }

    server.events.on('twilio.event', handler)

    // eslint-disable-next-line no-unused-expressions
    await agent.post('/medable/v2/integrations/twilio/video/callback/test-org')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({
        StatusCallbackEvent: 'room-created',
        Timestamp: new Date().getTime(),
        SequenceNumber: 0,
        ParticipantIdentity: participants[0]._id,
        RoomName: room._id
      })
    await Promise.all([
      ...participantPayLoad(participants[0]._id, room, 3),
      ...participantPayLoad(participants[1]._id, room, 10)
    ])
    await agent.post('/medable/v2/integrations/twilio/video/callback/test-org')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({
        StatusCallbackEvent: 'room-ended',
        Timestamp: new Date().getTime(),
        SequenceNumber: 0,
        ParticipantIdentity: participants[0]._id,
        RoomName: room._id,
        RoomDuration: new Date().getTime() - start
      })

    const events = await promised(null, sandboxed(function() {
      /* global script, org */
      return org.objects.roomevent.find({ roomId: script.arguments }).skipAcl().grant(4).toArray()
    }, {
      runtimeArguments: room._id
    }))

    should.not.exists(err)
    should(events.length).equal(30)

  })

})
