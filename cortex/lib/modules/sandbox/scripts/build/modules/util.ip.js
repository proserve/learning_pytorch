'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var IPv4Address = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/,
IPv4CidrRange = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(\d|[1-2]\d|3[0-2]))$/;

exports = module.exports = {

  is_ipv4: function is_ipv4(v) {
    return !!(v && typeof v === 'string' && IPv4Address.test(v));
  },

  is_cidr: function is_cidr(v) {
    return !!(v && typeof v === 'string' && IPv4CidrRange.test(v));
  },

  contains_ip: function contains_ip(list, v) {

    list = Array.isArray(list) ? list : list ? [list] : [];
    var len = list.length;
    while (len--) {
      var match = list[len];
      if (exports.is_cidr(match) && exports.ip4incidr(v, match) || exports.is_ipv4(v) && match === v) {
        return true;
      }
    }
    return false;

  },

  ip4toint: function ip4toint(ip) {
    if (exports.is_ipv4(ip)) {
      return ip.split('.').reduce(function (a, b) {return (+a << 8) + +b;});
    }
    return 0;
  },

  inttoip4: function inttoip4(v) {
    return [24, 16, 8, 0].map(function (i) {return Number(v) >> i & 255;}).join('.');
  },

  ip4incidr: function ip4incidr(ip, cidr) {

    if (!exports.is_ipv4(ip) || !exports.is_cidr(cidr)) {
      return false;
    }

    var cache$ = cidr.split('/'),
    maskLen = cache$[1],
    mask = maskLen === '0' ? 0 : -1 << 32 - maskLen,_map =
    [ip, cache$[0]].map(function (ip) {return mask & exports.ip4toint(ip);}),_map2 = _slicedToArray(_map, 2),_ip = _map2[0],_cidr = _map2[1];
    return _ip === _cidr;
  } };