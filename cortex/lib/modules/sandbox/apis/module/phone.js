'use strict'

const { phone, validation: { isShortCode } } = require('../../../../modules'),
      { isSet, rBool } = require('../../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      phoneUtil = phone.PhoneNumberUtil.getInstance(),
      phoneNumberTypeInverted = objectFlip(phone.PhoneNumberType),
      mobileTypes = [phone.PhoneNumberType.MOBILE, phone.PhoneNumberType.FIXED_LINE_OR_MOBILE]

function objectFlip(obj) {
  return Object.entries(obj).reduce((ret, entry) => {
    const [ key, value ] = entry
    ret[ value ] = key
    return ret
  }, {})
}

module.exports = {

  version: '1.0.0',

  isValidNumber: async function(script, message, value) {
    return phone.isValidNumber(value)
  },

  countryForE164Number: async function(script, message, value) {
    return phone.countryForE164Number(value)
  },

  cleanPhone: async function(script, message, value) {
    return phone.cleanPhone(value)
  },

  isShortCode: async function(script, message, value) {
    return isShortCode(value)
  },

  isPossibleNumber: async function(script, message, value) {
    return phoneUtil.isPossibleNumber(phoneUtil.parse(value))
  },

  getNumberType: async function(script, message, value) {
    const type = phoneUtil.getNumberType(phoneUtil.parse(value)),
          str = phoneNumberTypeInverted[type]

    if (isSet(str)) {
      return str.toLowerCase()
    }
    return 'unknown'
  },

  /**
   *
   * @param script
   * @param message
   * @param value
   * @param options
   *  allowShortCode (Boolean=false) number can be a shortcode
   * @returns {Promise<*>}
   */
  format: async function(script, message, value, options) {

    const allowShortCode = options && options.allowShortCode

    if (allowShortCode && isShortCode(value)) {
      return value
    }
    if (typeof value === 'string') {
      value = phone.cleanPhone(value)
      if (value[0] !== '+') value = '+' + value
    }
    return value
  },

  /**
   *
   * @param script
   * @param message
   * @param value
   * @param options
   *  allowShortCode (Boolean=false) number can be a shortcode
   *  requireMobile (Boolean=false) number must be a mobile type
   * @returns {Promise<boolean>}
   */
  validate: async function(script, message, value, options) {

    const allowShortCode = options && options.allowShortCode,
          requireMobile = rBool(options && options.requireMobile, false)

    value = String(value)

    try {
      if (allowShortCode && isShortCode(value)) {
        return true
      }
      let parsed = phoneUtil.parse(value)
      if (phoneUtil.isPossibleNumber(parsed)) {
        if (phone.isValidNumber(value)) {
          if (!requireMobile || ~mobileTypes.indexOf(phoneUtil.getNumberType(parsed))) {
            return true
          }
        }
      }
    } catch (e) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: e.message })
    }

    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid number' })

  }

}
