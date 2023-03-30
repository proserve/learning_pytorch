'use strict'

const {
        config,
        db,
        driver: {
          Driver
        }
      } = require('../../modules'),
      {
        promised, sortKeys, array: toArray, isSet, version, equalIds, path: pathTo
      } = require('../../utils'),
      { roles } = require('../../consts'),
      AccessPrincipal = require('../../access-principal'),
      acl = require('../../acl')

module.exports = function(_id, callback) {

  let err

  Promise.resolve(null)
    .then(async() => {

      const { models: { Org, Account } } = db,
            medable = await Org.loadOrg('medable'),
            admin = AccessPrincipal.synthesizeOrgAdmin(medable),
            driver = new Driver(admin, Org),
            org = await driver.readOne(
              {
                where: { _id },
                crossOrg: true,
                paths: [
                  'code', 'roles', 'state',
                  'apps', 'serviceAccounts', 'deployment',
                  'configuration.researchEnabled', 'configuration.maxApps', 'configuration.maxAccounts',
                  'configuration.axon', 'configuration.scripting', 'configuration.reporting',
                  'configuration.accounts', 'configuration.televisit', 'configuration.allowWsJwtScopes'
                ]
              },
              {
                grant: 'read'
              }
            ),
            pkg = {
              name: org.code,
              version: '-',
              dependencies: {
                cortex: version()
              },
              packages: [{
                name: 'cortex',
                description: 'Medable Cortex',
                version: version(),
                configuration: {
                  state: pathTo(org, 'state'),
                  deployment: writeObject(org, ['deployment.enabled', 'deployment.availability', 'deployment.supportOnly']).deployment,
                  ...writeObject(
                    org,
                    [
                      'configuration.accounts.enableEmail',
                      'configuration.accounts.enableUsername',
                      'configuration.accounts.requireEmail',
                      'configuration.accounts.requireMobile',
                      'configuration.accounts.requireUsername',
                      'configuration.allowWsJwtScopes',
                      'configuration.maxAccounts',
                      'configuration.maxApps',
                      'configuration.reporting.enabled',
                      'configuration.scripting.scriptsEnabled',
                      'configuration.scripting.types.job.maxOps',
                      'configuration.scripting.types.job.timeoutMs',
                      'configuration.scripting.types.route.maxOps',
                      'configuration.scripting.types.route.timeoutMs',
                      'configuration.scripting.types.trigger.maxOps',
                      'configuration.scripting.types.trigger.timeoutMs',
                      'configuration.scripting.types.deployment.maxOps',
                      'configuration.scripting.types.deployment.timeoutMs',
                      'configuration.scripting.types.export.maxOps',
                      'configuration.scripting.types.export.timeoutMs',
                      'configuration.scripting.types.policy.maxOps',
                      'configuration.scripting.types.policy.timeoutMs',
                      'configuration.scripting.types.transform.maxOps',
                      'configuration.scripting.types.transform.timeoutMs',
                      'configuration.televisit.availableRegions',
                      'configuration.televisit.defaultRegion',
                      'configuration.televisit.enableRecording',
                      'configuration.televisit.maxConcurrentRooms',
                      'configuration.televisit.roomsEnabled'
                    ]
                  ).configuration,
                  administrators: await Account.collection
                    .find({ org: _id, object: 'account', reap: false, roles: roles.admin })
                    .sort({ email: 1 })
                    .project({ _id: 0, email: 1, lastLogin: '$stats.lastLogin.time', roles: 1, locked: 1 })
                    .toArray()
                    .map(v => ({
                      ...v,
                      roles: acl.expandRoles(org.roles, v.roles)
                        .map(r => org.roles.find(v => equalIds(r, v._id))?.code || _id.toString())
                        .sort((a, b) => a.localeCompare(b))
                    })),
                  apps: org.apps.map(v => v.name || `${v.label} (unnamed)`).sort((a, b) => a.localeCompare(b)),
                  serviceAccounts: org.serviceAccounts.map(v => v.name || `${v.label} (unnamed)`).sort((a, b) => a.localeCompare(b))
                }
              }]
            },
            axon = await promised(config, 'get', org, 'axon__version'),
            ec = await promised(config, 'get', org, 'ec__version'),
            tv = await promised(config, 'get', org, 'tv__config')

      // study configuration - assume contexts collection

      if (axon) {

        const collection = await db.connection.db.collection('contexts'),
              study = await collection.aggregate([
                {
                  $match: { org: _id, object: 'c_study', reap: false }
                },
                {
                  $limit: 1
                // },
                // {
                //   $lookup: {
                //     from: 'contexts',
                //     let: { org: '$org', study: '$_id' },
                //     pipeline: [
                //       {
                //         $match: {
                //           $expr: {
                //             $and: [
                //               { $eq: [ '$org', '$$org' ] },
                //               { $eq: [ '$object', 'c_task' ] },
                //               { $eq: [ '$reap', false ] },
                //               { $eq: [ '$c_study._id', '$$study' ] }
                //             ]
                //           }
                //         }
                //       }
                //     ],
                //     as: 'tasks'
                //   }
                },
                {
                  $project: {
                    _id: false,
                    name: 'axon-study',
                    description: '$c_name',
                    version: '-'
                  }
                }
              ]).next()

        if (study) {
          pkg.dependencies.study = study.version
          pkg.packages.push(study)
        }

      }

      // backend applications

      if (axon) {
        pkg.dependencies.axon = axon.version
        pkg.packages.push({
          name: 'axon',
          description: 'Medable Axon',
          version: axon.version,
          configuration: {
            ...writeObject(org.configuration, ['axon.enabled', 'axon.exports', 'axon.trials']).axon,
            researchEnabled: pathTo(org, 'configuration.researchEnabled')
          }
        })
      }

      if (ec) {
        pkg.dependencies.axon = ec.version
        pkg.packages.push({
          name: 'ec',
          description: 'Medable eConsent',
          version: ec.version
        })
      }

      if (tv) {
        pkg.dependencies.tv = tv.version
        pkg.packages.push({
          name: 'tv',
          description: 'Medable Televisit',
          version: tv.version
        })
      }

      // frontend applications
      for (const { name, version } of toArray(org?.configuration?.axon?.apps)) {
        pkg.dependencies[name] = version
        pkg.packages.push({
          name,
          version
        })
      }

      // merge in default apps.
      for (const { name, version } of toArray(medable?.configuration?.axon?.apps).filter(v => v.default)) {
        if (!isSet(pkg.dependencies[name])) {
          pkg.packages.push({
            name,
            version,
            default: true
          })
        }
      }

      pkg.dependencies = sortKeys(pkg.dependencies)
      pkg.packages.sort((a, b) => a.name.localeCompare(b.name))

      return pkg

    })
    .catch(e => {
      err = e
    })
    .then(result => {
      callback(err, result)
    })

}

function writeObject(from, paths) {
  const into = {}
  for (const path of paths) {
    pathTo(into, path, pathTo(from, path))
  }
  return into
}
