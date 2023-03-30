'use strict'

const pf = require('google-libphonenumber')

module.exports = pf
module.exports.countryForE164Number = countryForE164Number
module.exports.isValidNumber = isValidNumber
module.exports.cleanPhone = cleanPhone

/*

 Copyright (C) Alan Beebe (alan.beebe@gmail.com).

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 Usage...

 This is the same type of code used by cell phones when you enter
 a phone number into your dialer app.  Your phone already knows
 what country you are a subscriber in, so it assumes you are entering
 a local number, unless of course you prefix the number with a +, or
 in the USA you could also prefix the number with 011 to indicate you
 wish to dial internationally.  This code functions the same way.

 Lets assume your in the United States and you enter the following
 phone number: 8646978257

 countryForE164Number("US", "+18646978257");
 Returns: US

 countryCodeToName("US");
 Returns: United States

 */

// -------------------------------------------------------------------------
function countryForE164Number(phone) {
  /*

     Return the country code for an e164 formatted number

     phone (String) phone number in e164 format to return the country code for

     */
  try {
    phone = cleanPhone(phone)
    const phoneUtil = pf.PhoneNumberUtil.getInstance(),
          number = phoneUtil.parseAndKeepRawInput(phone),
          output = phoneUtil.getRegionCodeForNumber(number)
    return output.toString()
  } catch (e) {
    return ''
  }
}

// -------------------------------------------------------------------------

function isValidNumber(phone, country) {
  /*

     Tests whether a phone number matches a valid pattern. Note this doesn't
     verify the number is actually in use, which is impossible to tell by just
     looking at a number itself.

     */

  try {
    phone = cleanPhone(phone)
    const phoneUtil = pf.PhoneNumberUtil.getInstance(),
          number = phoneUtil.parseAndKeepRawInput(phone, country)
    return phoneUtil.isValidNumber(number)
  } catch (e) {
    return false
  }
}

// -------------------------------------------------------------------------
function cleanPhone(phone) {
  /*

     Remove any non numeric characters from the phone number but leave any plus sign at the beginning

     phone (String) phone number to clean

     */

  phone = phone.replace(/[^\d+]/g, '')
  if (phone.substr(0, 1) === '+') {
    phone = '+' + phone.replace(/[^\d]/g, '')
  } else {
    phone = phone.replace(/[^\d]/g, '')
  }
  return phone
}
