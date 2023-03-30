const should = require('should'),
      semverCompare = require('semver-compare'),
      packageJson = require('../../../../package.json'),
      cortexServiceDependency = packageJson.dependencies?.['cortex-service']

describe('CTXAPI-1526 - Egress proxy', function() {

  it('should be avilable', () => {

    cortexServiceDependency.includes('git+ssh://git@gitlab.medable.com:platform/cortex-service').should.be.true

    const tagOrBranch = cortexServiceDependency.includes('#') ? cortexServiceDependency.split('#')[1] : cortexServiceDependency,
          version = tagOrBranch.includes('/') ? tagOrBranch.split('/')[1] : tagOrBranch

    if(!['1.3.4-1', '1.3.5-1'].includes(version) && semverCompare(version, '1.3.6') === -1){
        throw new Error(`cortex-service version must be 1.3.4-1, 1.3.5-1, or 1.3.6+. Found ${version}`)
    }

  })

})
