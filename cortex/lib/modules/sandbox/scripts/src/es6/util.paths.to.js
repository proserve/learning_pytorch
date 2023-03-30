const { toString } = Object.prototype,
      test = '[object String]',
      stringTest = (string) => toString.call(string) === test

let Undefined

exports = module.exports = function(obj, path, value, returnTopOnWrite) {
  if (obj === null || obj === Undefined) return Undefined
  const isString = stringTest(path),
        isArray = Array.isArray(path),
        p = isString && (isArray ? path : path.split('.')),
        write = arguments.length > 2

  if (!isString && !isArray) return Undefined

  if (write) {
    if (obj === null || obj === Undefined) obj = {}
    const top = obj
    for (let i = 0, j = p.length - 1; i < j; i++) {
      if (obj[p[i]] === null || obj[p[i]] === Undefined) {
        obj[p[i]] = {}
      }
      obj = obj[p[i]]
    }
    obj[p[p.length - 1]] = value
    if (returnTopOnWrite) return top
  } else {
    for (let i = 0, j = p.length; i < j; i++) {
      if (obj !== null && obj !== Undefined) {
        obj = obj[p[i]]
      }
    }
  }
  return obj
}
