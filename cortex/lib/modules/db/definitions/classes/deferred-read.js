
let Undefined

class DeferredRead {

  constructor(node, ac, input, selection, value) {
    this.node = node
    this.ac = ac
    this.resourcePath = ac.getResource()
    this.selection = selection
    this.input = input
    this.output = null
    this.value = value
  }

  toJSON() {
    return Undefined
  }

  async init(keyOrIndex, objOrArray, isArray, top) {
    this.key = keyOrIndex
    this.parent = objOrArray
    this.isArray = isArray
    this.output = top
  }

  async read() {
    return Undefined
  }

}

class GroupedRead extends DeferredRead {

}

module.exports = {
  DeferredRead,
  GroupedRead
}
