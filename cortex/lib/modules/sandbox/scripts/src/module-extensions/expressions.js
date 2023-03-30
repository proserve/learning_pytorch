
const { Cursor, ApiCursor, BufferedApiCursor } = require('util.cursor'),
      pathTo = require('util.paths.to'),
      clone = require('clone'),
      copy = clone(module.exports),
      cursorWrap = {
        'pipeline.run': module.exports.pipeline.run,
        'pipeline.evaluate': module.exports.pipeline.evaluate,
        'runtime.pipeline.run': module.exports.runtime.pipeline.run,
        'runtime.pipeline.evaluate': module.exports.runtime.pipeline.evaluate
      }

Object.keys(cursorWrap).forEach((path) => {

  pathTo(copy, path, (expression, input, ...args) => {

    if (input && input instanceof Cursor) {
      if (input instanceof BufferedApiCursor) {
        input.shared()
      }
      input = input.passthru(false)
    }

    let output = cursorWrap[path](expression, input, ...args)

    if (output && output.object === 'cursor' && output._id) {
      output = new ApiCursor(output._id)
    }

    return output

  })

})

module.exports = copy
