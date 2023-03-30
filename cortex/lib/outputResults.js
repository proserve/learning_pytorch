'use strict'

const { promisify } = require('util'),
      { info } = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      { isReadableStream } = require('cortex-service/lib/utils/values'),
      Fault = require('cortex-service/lib/fault'),
      { toJSON } = require('cortex-service/lib/utils/json'),
      {
        addTransformer, addConverter, outputResults, addErrorHandler,
        ReadableOutputConverter, CursorOutputConverter, OutputConverter
      } = require('cortex-service/lib/utils/output'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        modules: `${__dirname}/modules`,
        isPointer: () => lazy.modules.storage.isPointer,
        stream: () => lazy.modules.streams.stream
      })

class PointerOutputConverter extends ReadableOutputConverter {

  constructor(name = 'pointer') {
    super(name)
  }

  match(res, err, result) {
    return (!err && lazy.isPointer(result))
  }

  async outputValue(res, err, pointer) {

    return lazy.stream(res.req, res, pointer)
      .then(async result => {

        if (isReadableStream(result)) {
          const contentType = await promisify(pointer.getMime).call(pointer)
          return super.outputValue(res, null, result, { contentType })
        } else if (typeof result === 'string') {
          res.redirect(result)
        } else {
          return OutputConverter.prototype.outputValue.call(this, res, null, result, { contentType: 'application/json; charset=utf-8' })
        }

      })

  }

}
addConverter(new PointerOutputConverter())

class MyCursorOutputConverter extends CursorOutputConverter {

  async outputValue(res, err, cursor, options) {

    // store cursor for hacky activeCursor() calls from around
    // @todo unify operations under request/response stream operations
    res.cursor = cursor

    return super.outputValue(res, err, cursor, options)
      .catch(e => {
        res.cursor = null
        throw e
      })
      .then(v => {
        res.cursor = null
        return v
      })

  }

}
addConverter(new MyCursorOutputConverter())

addTransformer(async(res, err, result) => {

  if (res.hasTransforms()) {
    try {
      result = await res.transformResult(err, result)
    } catch (e) {
      err = Fault.from(e, null, true)
    }
  }
  if (err && config('debug.logStackTraces')) {
    info('debug.stackTrace', toJSON(err, { stack: true }))
  }
  return [err, result]

})

addErrorHandler((res, err) => {
  if (err) res.__err = err
})

module.exports = outputResults
