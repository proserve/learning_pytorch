'use strict';

module.exports.incrementIV = function (iv) {var count = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

  if (!Buffer.isBuffer(iv) || iv.length !== 16) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid initialization vector. Expected a 16-byte buffer.' });
  }

  if (typeof count !== 'number' || count < 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid count.' });
  }

  var mod = void 0,
  arr = new Uint8Array(iv),
  len = arr.length,
  i = len - 1;

  while (count !== 0) {
    mod = (count + arr[i]) % 256;
    count = Math.floor((count + arr[i]) / 256);
    arr[i] = mod;
    i -= 1;
    if (i < 0) {
      i = len - 1;
    }
  }


  return new Buffer(arr);

};