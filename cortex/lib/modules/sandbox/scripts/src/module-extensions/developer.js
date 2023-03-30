
import { ApiCursor } from 'util.cursor'
import pathTo from 'util.paths.to'
import clone from 'clone'

const copy = clone(module.exports),
      cursorWrap = {
        'environment.export': module.exports.environment.export,
        'environment.import': module.exports.environment.import
      }

Object.keys(cursorWrap).forEach((path) => {

  pathTo(copy, path, (...args) => new ApiCursor(cursorWrap[path](...args)._id))

})

module.exports = copy
