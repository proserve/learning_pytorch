const { Readable } = require('stream')

class RandomCharStream extends Readable {

  constructor({ sz = 1024, buflen = 1024, chars = 'abcdefghijklmnopqrstuvwxyz', objectMode = false } = {}) {

    super({ objectMode })

    this.chars = chars
    this.range = chars.length - 1
    this.sz = Math.max(0, sz)
    this.buflen = Math.max(1, buflen)

  }

  _read() {

    if (this.sz > 0) {
      const count = Math.min(this.sz, this.buflen),
            buf = this.get(count)

      if (this.readableObjectMode) {
        this.push({ buf })
      } else {
        this.push(buf)
      }

      this.sz -= count
    }
    if (this.sz <= 0) {
      this.push(null)
    }
  }

  get(count) {
    const buf = Buffer.alloc(count)
    for (let offset = 0; offset < count; ++offset) {
      buf.write(
        this.chars[Math.floor(Math.random() * (this.range + 1))],
        offset
      )
    }
    return buf
  }

}

module.exports = RandomCharStream
