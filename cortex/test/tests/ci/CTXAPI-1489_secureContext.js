const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      modules = require('../../../lib/modules'),
      server = require('../../lib/server'),
      config = require('cortex-service/lib/config'),
      FtpSrv = require('ftp-srv'),
      findFreePort = require('find-free-port')

describe('Use TLS Secure Context Options', () => {
  const password = Math.random().toString(36).slice(-12),
        username = 'aUser',
        host = '127.0.0.1',
        key = config('ftp.key'),
        cert = config('ftp.cert')

  async function createFTPServer(port, secureContext) {
    let ftpServer

    ftpServer = new FtpSrv({
      url: `ftp://${host}:${port}`,
      tls: secureContext
    })

    ftpServer.on('login', (data, resolve, reject) => {
      if (data.username === username && data.password === password) {
        return resolve({ root: '/' })
      }
      return reject(new Error('Invalid username or password', 401))
    })

    ftpServer.listen().then(() => {
      console.log('Ftp server is starting...')
    })

    return ftpServer
  }

  async function testSecureConnection(port, secureOptions = {}) {
    await promised(null, sandboxed(function() {
      /* global script */

      const ftp = require('ftp'),

            conn = ftp.create({
              host: script.arguments.host,
              port: script.arguments.port,
              username: script.arguments.username,
              password: script.arguments.password,
              secureOptions: script.arguments.secureOptions
            })

      conn.close()

    }, {
      runtimeArguments: {
        password,
        host,
        port,
        username,
        secureOptions
      }
    }))
  }

  before(async() => {
    await promised(modules.db, 'sequencedUpdate', server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.scripting.enableFtpModule': true
      }
    })

    await promised(server, 'updateOrg')
  })

  describe('Basic FTP Server', () => {

    let basicFtpServer,
        ftpServerPort

    before((done) => {
      findFreePort(3000, async(err, freePort) => {
        if (err) {
          throw new Error(`Error finding free port for FTP server: ${err}`)
        }
        ftpServerPort = freePort
        basicFtpServer = await createFTPServer(freePort, { key, cert })
        done()
      })
    })

    after(async() => {
      basicFtpServer.close()
    })

    it('should not connect with self signed cert', async() => {
      const secureOptions = {}
      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.equal(error.reason, 'self signed certificate')
    })

    it('should connect with self signed cert when rejectUnauthorized is false', async() => {
      const secureOptions = { rejectUnauthorized: false }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.not.exist(error)
    })

    it('should not accept a self signed cert not associated with the domain name', async() => {
      const secureOptions = { ca: cert }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      error.reason.includes('Hostname/IP does not match certificate\'s altnames').should.be.true()
    })

    it('should refuse TLSv1.3 cipher when max version is set to TLSv1.2 ', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        ciphers: 'TLS_AES_256_GCM_SHA384',
        maxVersion: 'TLSv1.2'
      }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      error.reason.includes('no ciphers available').should.be.true()
    })

    it('should accept TLSv1.3 cipher when min version is set to TLSv1.3', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        ciphers: 'TLS_AES_256_GCM_SHA384',
        minVersion: 'TLSv1.3'
      }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.not.exist(error)
    })

    it('should not accept invalid ecdhCurve', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        ecdhCurve: 'badCurve'
      }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.equal(error.reason, 'Failed to set ECDH curve')
    })

    it('should accept valid ecdhCurve and connect', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        ecdhCurve: 'P-521:P-384:P-256'
      }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.not.exist(error)
    })

    it('should not accept invalid secureProtocol', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        secureProtocol: 'TLS_not_a_method'
      }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.equal(error.reason, 'Unknown method: TLS_not_a_method')
    })

    it('should accept valid secureProtocol and connect', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        secureProtocol: 'TLS_method'
      }

      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.not.exist(error)
    })
  })

  describe('FTP Server with cipher', () => {

    const serverSecureOptions = {
      key,
      cert,
      ciphers: 'TLS_AES_256_GCM_SHA384' // TLSv1.3 cipher
    }

    let ftpServer,
        ftpServerPort

    before((done) => {
      findFreePort(3000, async(err, freePort) => {
        if (err) {
          throw new Error(`Error finding free port for FTP server: ${err}`)
        }
        ftpServerPort = freePort
        ftpServer = await createFTPServer(freePort, serverSecureOptions)
        done()
      })
    })

    after(async() => {
      ftpServer.close()
    })

    it('should not connect with TLSv1.3 server cipher when maxVersion is TLSv1.2', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        honorCipherOrder: true,
        maxVersion: 'TLSv1.2'
      }
      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.exist(error)
    })

    it('should connect with TLSv1.3 server cipher when maxVersion is TLSv1.3', async() => {
      const secureOptions = {
        rejectUnauthorized: false,
        honorCipherOrder: true,
        maxVersion: 'TLSv1.3'
      }
      let error

      try {
        await testSecureConnection(ftpServerPort, secureOptions)
      } catch (err) {
        error = err
      }

      should.not.exist(error)
    })
  })

})
