
/**
 * A stub class for handling return values from readers that want to continue reading even though a higher level reader was called.
 * @type {UnhandledResult}
 */
module.exports = class UnhandledResult {

  constructor(result) {
    this.result = result
  }

}
