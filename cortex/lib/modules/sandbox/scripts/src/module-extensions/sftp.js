
const sftp = module.exports,
      pConnection = Symbol('connection'),
      { OpaqueStream } = require('stream')

let Undefined

class Client {

  constructor(connection = Undefined) {
    this[pConnection] = connection
  }

  connect(options) {
    this.close()
    this[pConnection] = sftp.create(options)
  }

  close() {
    if (this[pConnection]) {
      sftp.instance.close(this[pConnection])
      this[pConnection] = Undefined
    }
  }

  list(path) {
    return sftp.instance.list(this[pConnection], path)
  }

  exists(path) {
    return sftp.instance.exists(this[pConnection], path)
  }

  stat(path) {
    return sftp.instance.stat(this[pConnection], path)
  }

  get(path, options) {
    return sftp.instance.get(this[pConnection], path, options)
  }

  put(path, input, options) {
    if (input instanceof OpaqueStream) {
      input = input.getOptions()
    }
    return sftp.instance.put(this[pConnection], path, input, options)
  }

  mkdir(path) {
    return sftp.instance.mkdir(this[pConnection], path)
  }

  delete(path) {
    return sftp.instance.delete(this[pConnection], path)
  }

  rename(path, to) {
    return sftp.instance.rename(this[pConnection], path, to)
  }

  chmod(path, mode) {
    return sftp.instance.chmod(this[pConnection], path, mode)
  }

  toJSON() {
    return {
      _id: this[pConnection] && this[pConnection]._id,
      object: (this[pConnection] && this[pConnection].object) || 'connection.sftp'
    }
  }

}

module.exports = {

  Client,

  create(options) {
    const client = new Client()
    client.connect(options)
    return client
  },

  list() {
    return sftp.list().map((connection) => new Client(connection))
  }

}
