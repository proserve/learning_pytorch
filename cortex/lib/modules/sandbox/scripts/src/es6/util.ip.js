const IPv4Address = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/,
      IPv4CidrRange = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(\d|[1-2]\d|3[0-2]))$/

exports = module.exports = {

  is_ipv4(v) { // eslint-disable-line camelcase
    return !!(v && (typeof v === 'string') && IPv4Address.test(v))
  },

  is_cidr(v) {
    return !!(v && (typeof v === 'string') && IPv4CidrRange.test(v))
  },

  contains_ip(list, v) {

    list = Array.isArray(list) ? list : (list ? [list] : [])
    let len = list.length
    while (len--) {
      const match = list[len]
      if ((exports.is_cidr(match) && exports.ip4incidr(v, match)) || (exports.is_ipv4(v) && match === v)) {
        return true
      }
    }
    return false

  },

  ip4toint(ip) {
    if (exports.is_ipv4(ip)) {
      return ip.split('.').reduce((a, b) => (+a << 8) + (+b))
    }
    return 0
  },

  inttoip4(v) {
    return [24, 16, 8, 0].map((i) => Number(v) >> i & 255).join('.')
  },

  ip4incidr(ip, cidr) {

    if (!exports.is_ipv4(ip) || !exports.is_cidr(cidr)) {
      return false
    }

    const cache$ = cidr.split('/'),
          maskLen = cache$[1],
          mask = maskLen === '0' ? 0 : -1 << 32 - maskLen,
          [_ip, _cidr] = [ip, cache$[0]].map((ip) => mask & exports.ip4toint(ip))
    return _ip === _cidr
  }

}
