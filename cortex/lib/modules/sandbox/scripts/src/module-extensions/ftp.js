const { OpaqueStream } = require('stream'),
      ftp = module.exports,
      pConnection = Symbol('connection')

let Undefined

class Client {

  constructor(connection = Undefined) {
    this[pConnection] = connection
  }

  connect(options) {
    this.close()
    this[pConnection] = ftp.create(options)
  }

  close() {
    if (this[pConnection]) {
      ftp.instance.close(this[pConnection])
      this[pConnection] = Undefined
    }
  }

  list(path) {
    return ftp.instance.list(this[pConnection], path)
  }

  get(path, options) {
    return ftp.instance.get(this[pConnection], path, options)
  }

  put(path, input, options) {
    if (input instanceof OpaqueStream) {
      input = input.getOptions()
    }
    return ftp.instance.put(this[pConnection], path, input, options)
  }

  mkdir(path, recursive) {
    return ftp.instance.mkdir(this[pConnection], path, recursive)
  }

  delete(path) {
    return ftp.instance.delete(this[pConnection], path)
  }

  rename(path, to) {
    return ftp.instance.rename(this[pConnection], path, to)
  }

  chmod(path, mode) {
    return ftp.instance.chmod(this[pConnection], path, mode)
  }

  toJSON() {
    return {
      _id: this[pConnection] && this[pConnection]._id,
      object: (this[pConnection] && this[pConnection].object) || 'connection.ftp'
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
    return ftp.list().map((connection) => new Client(connection))
  }

}
