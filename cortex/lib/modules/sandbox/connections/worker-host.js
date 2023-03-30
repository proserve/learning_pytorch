'use strict'

const Connection = require('./connection'),
      Messages = require('../messages'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      utils = require('../../../utils'),
      modules = require('../../index'),
      fs = require('fs'),
      path = require('path'),
      spawn = require('child_process').spawn,
      zmq = require('zeromq'),
      serviceRoot = require('cortex-service/lib/init-config'),
      // find the worker executable. always look for release before debug.
      workerExecutable = require('../../../utils').pathToSandbox('cortex-sandbox'),
      // make sure child processes are dead on exit.
      connections = new Set()

logger.silly(`found sandbox worker executable at ${workerExecutable}`)

function trackConnection(connection) {
  connections.add(connection)
}
function untrackConnection(connection) {
  connections.delete(connection)
}
process.on('exit', function() {
  for (let connection of Array.from(connections)) {
    try {
      connection.close()
    } catch (e) {}
  }
})

class WorkerHost extends Connection {

  constructor(options) {

    super()

    this.processMemoryLimitMB = utils.option(options, 'processMemoryLimitMB', config('sandbox.limits.processMemoryLimitMB'))
    this.transport = 'zmq'
    this.endpoint = config('sandbox.zmq.workerIpcPrefix') + utils.createId()
    this.bootstrap = utils.rVal(options.bootstrap, path.resolve(path.join(serviceRoot, 'lib/modules/sandbox/scripts/build/sandbox.js')))
    this.jspath = utils.rVal(options.jspath, path.resolve(path.join(serviceRoot, 'lib/modules/sandbox/scripts/build/modules')))

  }

  send(message) {
    modules.metrics.ipcAddMessage(message)
    if (this.process && this.socket) {
      this.socket.send(message.toFrames())
    } else {
      this.emit('error', Fault.create('script.error.sandboxClosed'))
    }
  }

  open() {

    if (!this.process) {

      trackConnection(this)

      const argv = [
        '--endpoint=' + this.endpoint,
        '--transport=zmq'
      ]
      if (this.bootstrap) {
        argv.push('--bootstrap=' + this.bootstrap)
      }
      if (this.jspath) {
        argv.push('--jspath=' + this.jspath)
      }
      if (config('sandbox.cacheNativeJsModules')) {
        argv.push('--cachejs')
      }

      this.process = spawn(
        workerExecutable,
        argv,
        {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        }
      )
      this.process.on('error', err => this.close(err))
      this.process.on('exit', (code, signal) => this.close(code === 0 ? null : Fault.create('cortex.error.sandbox', { reason: 'sandbox closed (' + code + ', ' + signal + ')' })))
      this.process.on('close', (code, signal) => this.close(code === 0 ? null : Fault.create('cortex.error.sandbox', { reason: 'sandbox closed (' + code + ', ' + signal + ')' })))
      this.process.on('disconnect', (code, signal) => this.close(Fault.create('cortex.error.sandbox', { reason: 'sandbox disconnected.' })))
      this.process.stderr.on('data', data => {
        try { logger.error('sandbox stderr', data.toString()) } catch (err) {}
      })
      // this.process.stdout.on('data', data => {
      //   try { logger.debug('sandbox stdout', data.toString()) } catch (err) {}
      // })

      this.socket = zmq.socket('pair')

      this.socket.on('message', (...buffers) => {
        const payload = []
        for (let i = 0; i < buffers.length; i++) {
          payload.push(buffers[i].toString())
        }
        let frames
        try {
          frames = Messages.parseFrames(payload)
        } catch (err) {
          // we can't just swallow this error because it would put the host into a state where the sandbox never returns. close the connection!
          logger.error('error parsing message frames', err.toJSON())
          this.close(Fault.create('cortex.error.sandbox', { reason: 'error parsing message frames' }))
          return
        }

        modules.metrics.ipcAddMessage(frames)
        this._handle(frames)

      })

      // @todo monitor socket
      /*
            socket.on('connect', function(fd, ep) {
                console.log('connect, endpoint:', ep);
            });
            socket.on('connect_delay', function(fd, ep) {console.log('connect_delay, endpoint:', ep);});
            socket.on('connect_retry', function(fd, ep) {console.log('connect_retry, endpoint:', ep);});
            socket.on('listen', function(fd, ep) {console.log('listen, endpoint:', ep);});
            socket.on('bind_error', function(fd, ep) {console.log('bind_error, endpoint:', ep);});
            socket.on('accept', function(fd, ep) {
                console.log('accept, endpoint:', ep);
            });
            socket.on('accept_error', function(fd, ep) {console.log('accept_error, endpoint:', ep);});
            socket.on('close', function(fd, ep) {console.log('close, endpoint:', ep);});
            socket.on('close_error', function(fd, ep) {console.log('close_error, endpoint:', ep);});
            socket.on('disconnect', function(fd, ep) {console.log('disconnect, endpoint:', ep);});
            socket.on('monitor_error', function(err) {
                console.log('Error in monitoring: %s, will restart monitoring in 5 seconds', err);
                setTimeout(function() { socket.monitor(500, 0); }, 5000);
            });
            socket.monitor(500, 0);
            */

      this.socket.bind(this.endpoint)

    }
  }

  _close() {
    if (this.process) {
      const pid = this.process.pid
      try {
        this.socket.removeAllListeners()
        this.socket.close()
      } catch (e) {
      }
      this.process.removeAllListeners()
      try {
        if (this.process.connected) {
          this.process.disconnect()
        }
      } catch (e) {}
      try {
        this.process.kill('SIGTERM')
      } catch (e) {}
      try {
        spawn('kill', [pid])
      } catch (e) {}
      try {
        const prefix = 'ipc://'
        if (this.endpoint.indexOf(prefix) === 0) {
          fs.unlink(this.endpoint.substr(prefix.length), () => {})
        }
      } catch (e) {}
      untrackConnection(this)
    }
    this.process = this.socket = null
  }

}

module.exports = WorkerHost
