const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      { waitForWorker } = require('../../../lib/utils')(),
      should = require('should')

describe('Build bundles with assets on i18n', function() {

  before(async() => {
    // delete bundles / i18n objects.
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        const cleanUpi18ns = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute(),
              cleanUpi18nbundles = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
        return [cleanUpi18ns, cleanUpi18nbundles]
      })), { forceWorkerRun: true })
  })

  before(async() => {
    // create some bundles
    await waitForWorker(server, 'media-processor', () => promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      global.org.objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'test_asset_1',
          name: 'test__en_US_test_asset_1',
          assets: [{
            key: 'com.medable.my_asset_file',
            value: {
              content: {
                source: 'buffer',
                buffer: 'my_asset_file'
              }
            }
          }],
          data: {
            com: {
              medable: {
                orgTitle: 'My Title'
              }
            }
          }
        },
        {
          locale: 'en_US',
          namespace: 'test_asset_2',
          assets: [{
            key: 'com.medable.my_asset_file',
            value: {
              content: {
                source: 'buffer',
                buffer: 'my_asset_file'
              }
            }
          }],
          name: 'test__en_US_test_asset_2',
          data: {
            data: {
              com: {
                medable: {
                  orgTitle: 'My Second Title'
                }
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()

    })))
  })

  after(async() => {
    // delete bundles / i18n objects.
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        const cleanUpi18ns = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute(),
              cleanUpi18nbundles = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
        return [cleanUpi18ns, cleanUpi18nbundles]
      })), { forceWorkerRun: true })
  })

  it('should build bundles with i18n with assets for same locale', async function() {

    const bundles = await promised(null, sandboxed(function() {
      const i18n = require('i18n')
      return i18n.buildBundles()
    }))

    should(bundles.length).equal(2)

  })

})
