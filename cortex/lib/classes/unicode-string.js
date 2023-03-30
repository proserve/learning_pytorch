
function sortSurrogates(s) { // returns array of utf-16 code points
  const chrs = []
  while (s.length) { // loop till we've done the whole string
    if (/[\uD800-\uDFFF]/.test(s.substr(0, 1))) { // test the first character
      // High surrogate found low surrogate follows
      chrs.push(s.substr(0, 2)) // push the two onto array
      s = s.substr(2) // clip the two off the string
    } else { // else BMP code point
      chrs.push(s.substr(0, 1)) // push one onto array
      s = s.substr(1) // clip one from string
    }
  } // loop
  return chrs
}

class UnicodeString {

  #cp

  constructor(str) {

    if (!(str instanceof UnicodeString)) {
      this.#cp = sortSurrogates(String(str))
    } else {
      this.#cp = str.cp
    }
  }

  get cp() {
    return this.#cp
  }

  get length() {
    return this.#cp.length
  }

  indexOf(search, start, len) {
    if (len) {
      return this.#cp.slice(start || 0, (start || 0) + len).indexOf(search) + (start || 0)
    } else {
      return this.#cp.slice(start || 0).indexOf(search) + (start || 0)
    }
  }

  substr(start, len) {
    if (len) {
      return this.#cp.slice(start, start + len).join('')
    } else {
      return this.#cp.slice(start).join('')
    }
  }

  substring(start, end) {
    return this.#cp.slice(start, end).join('')
  }

  replace(target, str) {
    if (str instanceof UnicodeString) str = str.cp.join('')
    if (target instanceof UnicodeString) target = target.cp.join('')
    return this.toString().replace(target, str)
  }

  toString() {
    return this.#cp.join('')
  }

}

module.exports = UnicodeString
