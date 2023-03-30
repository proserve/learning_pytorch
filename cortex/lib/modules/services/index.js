'use strict'

const async = require('async'),
      path = require('path'),
      fs = require('fs'),
      modules = require('../../modules'),
      config = require('cortex-service/lib/config'),
      Startable = require('cortex-service/lib/startable'),
      ServiceClient = require('cortex-service/lib/kube/service-client'),
      ClusterServiceClient = require('cortex-service/lib/kube/cluster-service-client')

class ServiceModule extends Startable {

  constructor() {

    super('services module')

    this.services = new Map()

    for (let [name, options] of Object.entries(config('services'))) {

      if (options) {
        let client, filename = path.join(__dirname, '..', `services/${name}.js`)

        if (fs.existsSync(filename)) {
          const Cls = require(filename)
          client = new Cls(options)
        } else {
          client = (options['client'] && options['watcher'] && options['enable'] !== undefined)
            ? options['enable'] ? new ClusterServiceClient(`${name}.cluster.service.client`, options) : null
            : new ServiceClient(`${name}.service.client`, options)
        }
        if (client) {
          this.services.set(name, client)
        }
      }

    }

  }

  _waitStart(callback) {

    const services = []

    async.each(
      Array.from(this.services.values()),
      (service, callback) => {
        services.push(service)
        service.start(callback)
      },
      err => {

        modules.metrics.register('services', () =>
          services.reduce((memo, service) => Object.assign(memo, { [service.name]: service.toJSON() }), {})
        )

        callback(err)

      })

  }

  _waitStop(callback) {

    async.each(
      Array.from(this.services.values()),
      (service, callback) => {
        service.stop(callback)
      },
      callback)

  }

  get(name) {

    return this.services.get(name)

  }

  list() {
    return Array.from(this.services.keys())
  }

}

module.exports = new Proxy(new ServiceModule(), {
  get: function get(target, property) {
    if (property in target) {
      return target[property]
    }
    return target.get(property)
  }
})
