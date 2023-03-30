const encodeLookup = '0123456789abcdef'.split(''),
      decodeLookup = []
let i = 0
while (i < 10) decodeLookup[0x30 + i] = i++
while (i < 16) decodeLookup[0x61 - 10 + i] = i++

module.exports = {

  encode(array) {

    let { length } = array,
        string = '',
        c,
        i = 0

    while (i < length) {
      c = array[i++]
      string += encodeLookup[(c & 0xF0) >> 4] + encodeLookup[c & 0xF]
    }
    return string

  },

  decode(string) {

    let sizeof = string.length >> 1,
        length = sizeof << 1,
        array = new Uint8Array(sizeof),
        n = 0,
        i = 0

    while (i < length) {
      array[n++] = decodeLookup[string.charCodeAt(i++)] << 4 | decodeLookup[string.charCodeAt(i++)]
    }

    return array
  }

}
