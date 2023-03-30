const should = require('should'),
  modules = require('../../../lib/modules'),
  server = require('../../lib/server'),
  sandboxed = require('../../lib/sandboxed'),
  { promised, sleep } = require('../../../lib/utils'),
  apnToken = 'apnToken',
  subscribePerformAndWait = async (fun, runtimeArguments = {}) => {
    let done = false,
      result = null

    const handler = (destination, message, payload, options, providerMessage) => {
      done = true
      result = { destination, message, payload, options, providerMessage }
    }

    server.events.on('worker.push', handler)

    await promised(null, sandboxed(fun, { runtimeArguments }))

    while (!done) { // eslint-disable-line no-unmodified-loop-condition
      await sleep(250)
    }

    server.events.removeListener('worker.push', handler)

    return result
  }

describe('CTXAPI-1682 Support for the old APN certificate topic encoding format when using an iOS apn device token', function () {

  let locationId,
    recipientId

  before(async () => {

    // create app
    await promised(null, sandboxed(function () {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $push: {
          apps: [{
            name: 'c_ctxapi_1682',
            label: 'c_ctxapi_1682',
            enabled: true,
            APNs: {
              cert: `-----BEGIN CERTIFICATE-----
MIIGDjCCBPagAwIBAgIIRYxvsrYv5RswDQYJKoZIhvcNAQELBQAwgZYxCzAJBgNV
BAYTAlVTMRMwEQYDVQQKDApBcHBsZSBJbmMuMSwwKgYDVQQLDCNBcHBsZSBXb3Js
ZHdpZGUgRGV2ZWxvcGVyIFJlbGF0aW9uczFEMEIGA1UEAww7QXBwbGUgV29ybGR3
aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkw
HhcNMTkxMjE5MjA1MzMxWhcNMjEwMTE3MjA1MzMxWjCBjDEgMB4GCgmSJomT8ixk
AQEMEGNvbS5tZWRhYmxlLmF4b24xLjAsBgNVBAMMJUFwcGxlIFB1c2ggU2Vydmlj
ZXM6IGNvbS5tZWRhYmxlLmF4b24xEzARBgNVBAsMCk0zUzczMkZHQzUxFjAUBgNV
BAoMDU1lZGFibGUsIEluYy4xCzAJBgNVBAYTAlVTMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAppwk/CwYv2NvlTUVlHBSImyFWwKbr4XrHJdhfoyd3+4T
YaayihHDKWjGkv4CO+EKuCMh3lqWbrGvc5/14QqCzlJQafVKVOyet3g7En8u7D5k
1wVjz3k9tIGSrYhXE1eGw2CP5B6l1EQBrlS3adI49U1jXbOqImVdQlbu9RGtRde0
MWSeAtmDBdbLDzLUIrNnUdx3egJ2lCee9lT5NsqO6L7jgCzbCPhTik6lJh/7dLDu
FpATgvW1j1Bb8y9zawG5+EnknlvciTm9Ur1HFkL5CNYvT69xuS/hnwQUYnwGNWmX
DcrO/R/7WADKD5y+qVDPe4oF58Hc7W31T79cnJqOOQIDAQABo4ICZjCCAmIwDAYD
VR0TAQH/BAIwADAfBgNVHSMEGDAWgBSIJxcJqbYYYIvs67r2R1nFUlSjtzCCARwG
A1UdIASCARMwggEPMIIBCwYJKoZIhvdjZAUBMIH9MIHDBggrBgEFBQcCAjCBtgyB
s1JlbGlhbmNlIG9uIHRoaXMgY2VydGlmaWNhdGUgYnkgYW55IHBhcnR5IGFzc3Vt
ZXMgYWNjZXB0YW5jZSBvZiB0aGUgdGhlbiBhcHBsaWNhYmxlIHN0YW5kYXJkIHRl
cm1zIGFuZCBjb25kaXRpb25zIG9mIHVzZSwgY2VydGlmaWNhdGUgcG9saWN5IGFu
ZCBjZXJ0aWZpY2F0aW9uIHByYWN0aWNlIHN0YXRlbWVudHMuMDUGCCsGAQUFBwIB
FilodHRwOi8vd3d3LmFwcGxlLmNvbS9jZXJ0aWZpY2F0ZWF1dGhvcml0eTATBgNV
HSUEDDAKBggrBgEFBQcDAjAwBgNVHR8EKTAnMCWgI6Ahhh9odHRwOi8vY3JsLmFw
cGxlLmNvbS93d2RyY2EuY3JsMB0GA1UdDgQWBBSoKG9kPsg6BFavImVUkMMLFYdT
bzAOBgNVHQ8BAf8EBAMCB4AwEAYKKoZIhvdjZAYDAQQCBQAwEAYKKoZIhvdjZAYD
AgQCBQAwdwYKKoZIhvdjZAYDBgRpMGcMEGNvbS5tZWRhYmxlLmF4b24wBQwDYXBw
DBVjb20ubWVkYWJsZS5heG9uLnZvaXAwBgwEdm9pcAwdY29tLm1lZGFibGUuYXhv
bi5jb21wbGljYXRpb24wDgwMY29tcGxpY2F0aW9uMA0GCSqGSIb3DQEBCwUAA4IB
AQAjjgOoQ+cvp8qTJE6yltEPuZfkDU0Kzbktk42XNijRx5SCdmH8JttXvZVww4fZ
fR1lHmlyLD1fsRYq3vq5tFm1htUe+slFxSmt95+zBezfVI7Ipq0EZLt73NjC5NKT
PDOpHMGnNbVusqP3jvqXr0qGs+q1xPLooKtj+BW2d6NLE+6ZEYaWtrq1xGXolv0N
ZJGv/wUlCfeWdV3SMiYx+Uq6s7AuO8GPfHkgvbYD5Y3qzB35jVB58Pb8lBGYvYz4
WYzweuCrSNyW6+NTQvDXPX2BmCZjgk56i9d7k7saBUPjfk3k7/fQXEnGqX/S+QRk
uXr2nMsItU48yosH1CTSN2ZX
-----END CERTIFICATE-----`,
              key: `-----BEGIN PRIVATE KEY-----
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
-----END PRIVATE KEY-----`
            },
            clients: [{
              label: 'c_ctxapi_1682',
              enabled: true,
              readOnly: false,
              sessions: true,
              allowNameMapping: true
            }]
          }]
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')

    const { _id, org: code } = await modules.db.models.account.findOne({ email: 'james+patient@medable.com' }),
      org = await modules.db.models.org.findOne({ org: code, object: 'org' }),
      { insertedId } = await modules.db.models.Location.collection.insertOne({
        org: code,
        accountId: _id,
        ios: {
          notification: {
            token: apnToken
          }
        },
        client: org.apps.find(app => app.name === 'c_ctxapi_1682').clients[0].key
      })

    locationId = insertedId
    recipientId = _id

  })

  after(async () => {

    await modules.db.models.Location.collection.deleteOne({ _id: locationId })

    // remove app
    await promised(null, sandboxed(function () {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $pull: {
          apps: ['c_ctxapi_1682']
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')

  })

  it('Should send a push notification using APNs', async () => {

    const result = await subscribePerformAndWait(function () {
      /* global script */
      const notifications = require('notifications')
      return notifications.send({}, {
        endpoints: {
          push: {
            message: 'message'
          }
        },
        recipient: script.arguments.recipientId
      })
    }, {
      recipientId
    })

    should.exist(result)
    should.exist(result.destination)
    result.destination.message.should.equal('message')
    result.destination.token.should.equal(apnToken)
    result.destination.topic.should.equal('com.medable.axon')

  })

})

describe('CTXAPI-1682 Support for the new APN certificate topic encoding format when using an iOS apn device token', function () {

  let locationId,
    recipientId

  before(async () => {

    // create app
    await promised(null, sandboxed(function () {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $push: {
          apps: [{
            name: 'c_ctxapi_1682',
            label: 'c_ctxapi_1682',
            enabled: true,
            APNs: {
              cert: `-----BEGIN CERTIFICATE-----
MIIG5jCCBc6gAwIBAgIQCtrcg8TEiAwYHnqoNTuS0TANBgkqhkiG9w0BAQsFADB1
MUQwQgYDVQQDDDtBcHBsZSBXb3JsZHdpZGUgRGV2ZWxvcGVyIFJlbGF0aW9ucyBD
ZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTELMAkGA1UECwwCRzQxEzARBgNVBAoMCkFw
cGxlIEluYy4xCzAJBgNVBAYTAlVTMB4XDTIyMDQxMjE0MDQ1M1oXDTIzMDUxMjE0
MDQ1MlowgbwxODA2BgoJkiaJk/IsZAEBDChjb20ubWVkYWJsZS5ub3ZvLW5vcmRp
c2stZnJvbnRpZXIzLmNoaW5hMUYwRAYDVQQDDD1BcHBsZSBQdXNoIFNlcnZpY2Vz
OiBjb20ubWVkYWJsZS5ub3ZvLW5vcmRpc2stZnJvbnRpZXIzLmNoaW5hMRMwEQYD
VQQLDApNM1M3MzJGR0M1MRYwFAYDVQQKDA1NZWRhYmxlLCBJbmMuMQswCQYDVQQG
EwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALPmdNibhUrBnkqB
cLQrv4+XqMcpsiiaLUkOztIw2UzIESkknlWnQHIs1Yuguy8JzIggs2Dq4aaeWgI5
RNPOUV1cgYI7kTaXTJI6S8XP3QFbs0h4Lhch8W8Iplw1fNkf63xVMs6411L7n/5M
MhoA0twJ+O1QPrSJupkKdrsm4tpFkD1kMmh7DtrQqcnHW3sB/nnvydzxeN08beco
kqk34fFAV2rPTGAtTlFz3wt/wBrFLcdOuhMENCsqa4JuE8Bh6mlY1/LroabLF/O8
uKu2LsqSJ8J/WKEBMaTnFP6kcTYfYjemEeqdnrTOdZpCJwJVC80AGFWTXsOZxbVz
5Qaf0isCAwEAAaOCAygwggMkMAwGA1UdEwEB/wQCMAAwHwYDVR0jBBgwFoAUW9n6
HeeaGgujmXYiUIY+kchbd6gwcAYIKwYBBQUHAQEEZDBiMC0GCCsGAQUFBzAChiFo
dHRwOi8vY2VydHMuYXBwbGUuY29tL3d3ZHJnNC5kZXIwMQYIKwYBBQUHMAGGJWh0
dHA6Ly9vY3NwLmFwcGxlLmNvbS9vY3NwMDMtd3dkcmc0MDEwggEdBgNVHSAEggEU
MIIBEDCCAQwGCSqGSIb3Y2QFATCB/jCBwwYIKwYBBQUHAgIwgbYMgbNSZWxpYW5j
ZSBvbiB0aGlzIGNlcnRpZmljYXRlIGJ5IGFueSBwYXJ0eSBhc3N1bWVzIGFjY2Vw
dGFuY2Ugb2YgdGhlIHRoZW4gYXBwbGljYWJsZSBzdGFuZGFyZCB0ZXJtcyBhbmQg
Y29uZGl0aW9ucyBvZiB1c2UsIGNlcnRpZmljYXRlIHBvbGljeSBhbmQgY2VydGlm
aWNhdGlvbiBwcmFjdGljZSBzdGF0ZW1lbnRzLjA2BggrBgEFBQcCARYqaHR0cHM6
Ly93d3cuYXBwbGUuY29tL2NlcnRpZmljYXRlYXV0aG9yaXR5MBMGA1UdJQQMMAoG
CCsGAQUFBwMCMDIGA1UdHwQrMCkwJ6AloCOGIWh0dHA6Ly9jcmwuYXBwbGUuY29t
L3d3ZHJnNC0yLmNybDAdBgNVHQ4EFgQUVGAmCVHMa7IDlt7Hxtdg9ocr8BgwDgYD
VR0PAQH/BAQDAgeAMIHDBgoqhkiG92NkBgMGBIG0MIGxDChjb20ubWVkYWJsZS5u
b3ZvLW5vcmRpc2stZnJvbnRpZXIzLmNoaW5hMAcMBXRvcGljDC1jb20ubWVkYWJs
ZS5ub3ZvLW5vcmRpc2stZnJvbnRpZXIzLmNoaW5hLnZvaXAwBgwEdm9pcAw1Y29t
Lm1lZGFibGUubm92by1ub3JkaXNrLWZyb250aWVyMy5jaGluYS5jb21wbGljYXRp
b24wDgwMY29tcGxpY2F0aW9uMBAGCiqGSIb3Y2QGAwEEAgUAMBAGCiqGSIb3Y2QG
AwIEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQCktpk/2EjhsOSPFAtycxtqdUVbA628
H2n9XjNTkH5bW7HBxWYqywkM47LjtD2OiyXo1MeFnHx2noHCCKuijm2LBwQq8BZn
Ub8f+/5q8WEPXsSYG4CR6hCxoXr/5WSfF+Ldt2h0bn3HUsHOOK81nXq/sbizXHgb
HXIEFzXxP3bB9LVlnpL3ejK3FIHGnkkX8RYbq4UPBaS/+QXzRew2DwL7Kb4z/KVi
egXzBnwCANgeRUMA8OzcKUfybk9jTjFXHp2QmrifuFqUJZ9CeC/JSKkCPcj8L7NX
JcFrccYRaO3tiLeOHDWe30OXM6iI0Cd8L3WGyz0z2G/dBJl0f4jo0rCi
-----END CERTIFICATE-----`,
              key: `-----BEGIN PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
NhAAAAAwEAAQAAAYEA2/3icvndJFtW/RgvMe+pjCiCQQYJLFKrsvUKjVpYTxrTNWXMPpaS
kIEVFL62wn9fw6N71xxoGOweB5noKA16ooZo3yXkg266uyV+BJf3KNrMxcOuBGsWElRgwo
TBfCLU1nDh7yWnc+g8hYaPbMarQtQgOxpWrHvDY2ft7ClVUKCAMrd5YUkO61MvY+VA2FsD
C+65oPTgBSsgSQyFmdkw50mUclAnWOEXTv1D0lG+unu+bPtQgMnDBAxPlmDo/Womx9Kj3y
EGHQmNoiJXs5ShhruPi0KxRjEKns1LqzXxD6wucnOpwoELvZBArKJwXJ+AdOA+m3oIOeLT
2gZZJg66nL5XJagRhqr6bPXXry7sd5FMVJmgI+lQu0lNCzNz/MQahGdx9H9VIS9aBFOCZ2
2dCpSdXLw1RoKdOmrrfFPV2H6uvVTOcPQpz1TuYuIR2brlQqWKFTr0v2JYI7f485h3QZBI
Gi4qcJH6BPCb9s7x+86qLmgbBcoX3mFyhSJjlo8LAAAFmOF7yLPhe8izAAAAB3NzaC1yc2
EAAAGBANv94nL53SRbVv0YLzHvqYwogkEGCSxSq7L1Co1aWE8a0zVlzD6WkpCBFRS+tsJ/
X8Oje9ccaBjsHgeZ6CgNeqKGaN8l5INuurslfgSX9yjazMXDrgRrFhJUYMKEwXwi1NZw4e
8lp3PoPIWGj2zGq0LUIDsaVqx7w2Nn7ewpVVCggDK3eWFJDutTL2PlQNhbAwvuuaD04AUr
IEkMhZnZMOdJlHJQJ1jhF079Q9JRvrp7vmz7UIDJwwQMT5Zg6P1qJsfSo98hBh0JjaIiV7
OUoYa7j4tCsUYxCp7NS6s18Q+sLnJzqcKBC72QQKyicFyfgHTgPpt6CDni09oGWSYOupy+
VyWoEYaq+mz1168u7HeRTFSZoCPpULtJTQszc/zEGoRncfR/VSEvWgRTgmdtnQqUnVy8NU
aCnTpq63xT1dh+rr1UznD0Kc9U7mLiEdm65UKlihU69L9iWCO3+POYd0GQSBouKnCR+gTw
m/bO8fvOqi5oGwXKF95hcoUiY5aPCwAAAAMBAAEAAAGAO4rJ4aizLAX002faTj+5ug+0wX
iqvu5ZPoSIKJ4NTMvL4qX80+vZG3d0hzrfKGFlQARdnmk325b8wb3sUfrj+F08wTj2UoSD
0edh5khjQxGFXvmJffSl8qwXzE42OC0NQkUnQZ0FZ5+x0coLw7s520qitpx4XRLaXWthwA
un5byrNg7msWgeu562Mul31Zc8idxBLclZYMy9XkgfWPap/8+weAgtviaeMmjmFGS/pKWd
cs3KijERsWTLnb35Ea3K9JPx787kgms9UMKw005spbx/ydIVdc4zLNy8KUvwS16oqTs4NT
1UjPXa5pOG5Blf9hXveA9DDhf6EDSb9E4GoQcnIR6VDWwcqsMby5bds8sE86tv4eW9vWkv
hfAo6sghFUOvYx/vUjNSB8k6sDfQz4dxTPc718oyx9i8C0HaldzBHUcsRUc3wUyL12ztGx
w/OUY6lEgVNksz6LIPg4dKeuOHX7k7lCjSr76VWEQHUtgZJvWO77eBfRJ/JTqIDtpxAAAA
wEIOquvWAjQTx2RdLtgFvH9hb/8Y7OBRQPq1wLUzxZtRO4aau0gYW0orJCkhzIJ6AfR07M
I8NXkDRjSYmTBfCItSYuNaelLwMXDYR7iH6N+OzACF0kULvpC5g4jyz8b8835T1gtjlWPt
jK/0gRBdauiv7hQ4zXGeXtkYjB43hIlgK0w//iFkbDPsw20keRkZzylaC2U7uhPOGMNXZP
3/xUhU3qQ4T0TT1Rp53ZCh/ikRDpLAC1k0ATJwh05Qlh3ZoAAAAMEA/BqZHYeT/3xnWhl4
CNqc2cle94K4rvaxgUr8sK+Mzv+B98EA/I70RmmbFVOaHCEdNtjz/AC6/Ho3z1MF8qPcHR
X56az73Yv3XoXlJwHld90nmgi+5eA0YfHaQRptYo0jXr9KlKBVqpFxEYhg+3E+YseDqJDx
MseDddJF+s1B/MW+95p5llsNhgkPCNfBVCV8S3LMZijj3FN+BkWHAhbYC7HmBBU38xKv6R
SbHiByQDacIrtFTqmUXNLNJnv9rxzfAAAAwQDfZD2ehFdWyyApfu+SQqKQAddaI1VVkN62
z2QbZnkpG3Sgvj33twJGTmU3gA8IsdLPy87aB48lo2AlKNv6F7nEiB7EdOtnHrFxj7+EpR
XaxoT7cqpD0F5CUrrggFHeHjOZKW3K2l+F0bfzAZdXdLD8mgboNEKPtCLUrkvpEH6tAAt7
Xli3Gh7KQk1EuiZhBYPnNxKf/mM7b3V3N2KX5ig6XxYnhd0GFCHG3R0BiLicvv5FMSbOcX
YiKPPxblp0J1UAAAAjYWRhbS5jb3Vsb25AQWRhbXMtTWFjQm9vay1Qcm8ubG9jYWw=
-----END PRIVATE KEY-----`
            },
            clients: [{
              label: 'c_ctxapi_1682',
              enabled: true,
              readOnly: false,
              sessions: true,
              allowNameMapping: true
            }]
          }]
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')

    const { _id, org: code } = await modules.db.models.account.findOne({ email: 'james+patient@medable.com' }),
      org = await modules.db.models.org.findOne({ org: code, object: 'org' }),
      { insertedId } = await modules.db.models.Location.collection.insertOne({
        org: code,
        accountId: _id,
        ios: {
          notification: {
            token: apnToken
          }
        },
        client: org.apps.find(app => app.name === 'c_ctxapi_1682').clients[0].key
      })

    locationId = insertedId
    recipientId = _id

  })

  after(async () => {

    await modules.db.models.Location.collection.deleteOne({ _id: locationId })

    // remove app
    await promised(null, sandboxed(function () {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $pull: {
          apps: ['c_ctxapi_1682']
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')

  })

  it('Should send a push notification using APNs', async () => {

    const result = await subscribePerformAndWait(function () {
      /* global script */
      const notifications = require('notifications')
      return notifications.send({}, {
        endpoints: {
          push: {
            message: 'message'
          }
        },
        recipient: script.arguments.recipientId
      })
    }, {
      recipientId
    })

    should.exist(result)
    should.exist(result.destination)
    result.destination.message.should.equal('message')
    result.destination.token.should.equal(apnToken)
    result.destination.topic.should.equal('com.medable.novo-nordisk-frontier3.china')

  })

})