
const http = module.exports,
      { ApiCursor } = require('util.cursor'),
      { OpaqueStream } = require('stream'),
      methods = ['get', 'head', 'patch', 'post', 'put', 'delete', 'options']

module.exports = {}

for (const [key, value] of Object.entries(http)) {

  if (methods.includes(key)) {

    Object.assign(
      module.exports,
      {
        [key]: function(...params) {

          const result = value.call(http, ...params),
                { cursor, stream } = result
          if (stream && stream._id && stream.object === 'stream') {
            result.stream = new OpaqueStream(stream)
          } else if (cursor && cursor._id && cursor.object === 'cursor') {
            result.cursor = new ApiCursor(cursor)
          }
          return result
        }

      })

  } else {

    Object.assign(module.exports, { [key]: value })
  }

}
