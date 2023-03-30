/**
 * Check if the given character code, or the character code at the first
 * character, is alphabetical.
 *
 * @param {string|number} character
 * @returns {boolean} Whether `character` is alphabetical.
 */
function isAlphabetical(character) {
  const code = typeof character === 'string' ? character.charCodeAt(0) : character

  return (
    (code >= 97 && code <= 122) /* a-z */ ||
    (code >= 65 && code <= 90) /* A-Z */
  )
}
/**
 * Check if the given character code, or the character code at the first
 * character, is alphanumerical.
 *
 * @param {string|number} character
 * @returns {boolean} Whether `character` is alphanumerical.
 */
function isAlphanumerical(character) {
  return isAlphabetical(character) || isDecimal(character)
}

/**
 * Check if the given character code, or the character code at the first
 * character, is decimal.
 *
 * @param {string|number} character
 * @returns {boolean} Whether `character` is a decimal
 */
function isDecimal(character) {
  const code = typeof character === 'string' ? character.charCodeAt(0) : character

  return code >= 48 && code <= 57 /* 0-9 */
}

module.exports = {
  isAlphabetical,
  isAlphanumerical,
  isDecimal
}
