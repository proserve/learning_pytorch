const { pathToSandbox } = require('../../../lib/utils'),
      should = require('should'),
      fs = require('fs'),
      serviceRoot = require('cortex-service/lib/init-config'),
      pathUtil = require('path'),
      homedir = require('os').homedir()

describe('pathToSandbox', () => {
  const sandboxName = 'dummy-file',
        release = pathUtil.join(serviceRoot, `/sandbox/build/Release/${sandboxName}`),
        debug = pathUtil.join(serviceRoot, `/sandbox/build/Debug/${sandboxName}`),
        path = `${homedir}/CTXAPI-1785/bin/${sandboxName}`

  before(() => {
    if (!fs.existsSync(pathUtil.join(serviceRoot, '/sandbox/build/Release'))) {
      fs.mkdirSync(pathUtil.join(serviceRoot, '/sandbox/build/Release'))
    }
    if (!fs.existsSync(pathUtil.join(serviceRoot, '/sandbox/build/Debug'))) {
      fs.mkdirSync(pathUtil.join(serviceRoot, '/sandbox/build/Debug'))
    }
    if (!fs.existsSync(`${homedir}/CTXAPI-1785/bin`)) {
      fs.mkdirSync(`${homedir}/CTXAPI-1785/bin`, { recursive: true })
    }

    process.env.PATH = `${homedir}/CTXAPI-1785/bin:${process.env.PATH}`
  })
  after(() => {
    const paths = process.env.PATH.split(':')
    paths.shift()
    process.env.PATH = paths.join(':')
    fs.rmdirSync(`${homedir}/CTXAPI-1785/bin`)
  })

  it('finds sandbox in release directory', () => {
    fs.writeFileSync(release, 'dummy data')
    pathToSandbox(sandboxName).should.equal(release)
    fs.unlinkSync(release)
  })

  it('finds sandbox in debug directory', () => {
    fs.writeFileSync(debug, 'dummy data')
    pathToSandbox(sandboxName).should.equal(debug)
    fs.unlinkSync(debug)
  })

  it('finds sandbox in $PATH', () => {
    fs.writeFileSync(path, 'dummy data')
    pathToSandbox(sandboxName).should.equal(path)
    fs.unlinkSync(path)
  })
})
