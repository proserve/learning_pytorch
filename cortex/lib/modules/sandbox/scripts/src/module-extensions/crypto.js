/* global Fault */

module.exports.incrementIV = function(iv, count = 0) {

  if (!Buffer.isBuffer(iv) || iv.length !== 16) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid initialization vector. Expected a 16-byte buffer.' })
  }

  if (typeof count !== 'number' || count < 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid count.' })
  }

  let mod,
      arr = new Uint8Array(iv),
      len = arr.length,
      i = len - 1

  while (count !== 0) {
    mod = (count + arr[i]) % 256
    count = Math.floor((count + arr[i]) / 256)
    arr[i] = mod
    i -= 1
    if (i < 0) {
      i = len - 1
    }
  }

  // eslint-disable-next-line node/no-deprecated-api
  return new Buffer(arr)

}
