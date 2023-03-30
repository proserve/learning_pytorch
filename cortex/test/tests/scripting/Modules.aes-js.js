'use strict'

module.exports = {

  main: function() {

    require('should')

    const aesjs = require('aes-js')

    {

      let aesCtr, encryptedBytes, decryptedBytes, decryptedText, encryptedHex

      // CTR - Counter (recommended)
      // 128-bit, 192-bit and 256-bit keys
      const // An example 128-bit key (16 bytes * 8 bits/byte = 128 bits)
            key = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            // Convert text to bytes
            text = 'Text may be any length you wish, no padding is required.',
            textBytes = aesjs.utils.utf8.toBytes(text)
      // The counter is optional, and if omitted will begin at 1
      aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5))
      encryptedBytes = aesCtr.encrypt(textBytes)
      // To print or store the binary data, you may convert it to hex
      encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes)
      // "a338eda3874ed884b6199150d36f49988c90f5c47fe7792b0cf8c7f77eeffd87
      //  ea145b73e82aefcf2076f881c88879e4e25b1d7b24ba2788"

      // When ready to decrypt the hex string, convert it back to bytes
      encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex)

      // The counter mode of operation maintains internal state, so to
      // decrypt a new instance must be instantiated.
      aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5))
      decryptedBytes = aesCtr.decrypt(encryptedBytes)

      // Convert our bytes back into text
      decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes)
      decryptedText.should.equal('Text may be any length you wish, no padding is required.')
    }

    {
      let aesCbc, encryptedBytes, decryptedBytes, decryptedText, encryptedHex

      // CBC - Cipher-Block Chaining (recommended)

      // An example 128-bit key
      const key = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],

            // The initialization vector (must be 16 bytes)
            iv = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],

            // Convert text to bytes (text must be a multiple of 16 bytes)
            text = 'TextMustBe16Byte',
            textBytes = aesjs.utils.utf8.toBytes(text)

      aesCbc = new aesjs.ModeOfOperation.cbc(key, iv)
      encryptedBytes = aesCbc.encrypt(textBytes)

      // To print or store the binary data, you may convert it to hex
      encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes)
      encryptedHex.should.equal('104fb073f9a131f2cab49184bb864ca2')

      // When ready to decrypt the hex string, convert it back to bytes
      encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex)

      // The cipher-block chaining mode of operation maintains internal
      // state, so to decrypt a new instance must be instantiated.
      aesCbc = new aesjs.ModeOfOperation.cbc(key, iv)
      decryptedBytes = aesCbc.decrypt(encryptedBytes)

      // Convert our bytes back into text
      decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes)
      decryptedText.should.equal('TextMustBe16Byte')

    }

    return true
  }
}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
