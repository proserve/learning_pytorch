const { route } = require('decorators')

class CustomRoute {

  @route('GET c_340_ping/:id', { name: 'c_340_get', weight: 1 })
  static getImpl({ req, res, body }) {
    return `The get! Your ID is ${req.params.id}, and your number is ${req.query.number}`
  }

  @route({
    weight: 1,
    method: 'POST',
    name: 'c_340_post',
    path: 'c_340_ping',
    acl: ['role.administrator']
  })
  postImpl({ req, body }) {
    return `The post! The number is ${body('theNumber')}`
  }

  @route({
    weight: 2,
    method: 'PATCH',
    name: 'c_340_patch_high',
    label: 'The highest priority patch',
    path: 'c_340_ping'
  })
  thisPatchGoesFirst({ req, body, next }) {

    let reqBody = body()
    req.memo('theWord', 'The bird')
    try {
      body('oldNumber', reqBody.patchNumber)
      body('patchNumber', reqBody.patchNumber + 12)
    } catch (e) { }
    next()
  }

  @route({
    weight: 1,
    method: 'PATCH',
    name: 'c_340_patch_low',
    label: 'The lowest priority patch',
    path: 'c_340_ping'
  })
  andThisPatchFollows({ req, body }) {
    let message
    try {
      message = `The world famous patch! New number is ${body('patchNumber')}, old number is ${body('oldNumber')}. ${req.memo('theWord')} is the word`
    } catch (e) {
      message = 'Something went wrong!'
    }

    return message
  }

  @route('PUT c_340_ping', {
    name: 'c_340_put',
    label: 'The PUT route',
    weight: 1
  })
  thePutImplementation({ req, res, body, next, runtime }) {

    body('object.id', new ObjectID())
    body('object.buffer', new Buffer(2)) // eslint-disable-line node/no-deprecated-api
    body('realDate', new Date())
    body('regexEven!', /^yo/)

    return [
      body('array.constructor.bad', 'news'),
      body('array.constructor.bad'),
      body.getLength('object.buffer'),
      body.getSize(),
      body.typeOf('date'),
      body.typeOf('realDate'),
      body.isArray('array'),
      body.getLength('array'),
      body('array.length'),
      body('string.length'),
      body('object.buffer.length'),
      body('regexEven!').test(body('string')),
      (/^yo/).test(body('string'))
    ]
  }

  @route('DELETE *', {
    name: 'c_340_delete_all',
    weight: 999
  })
  static firstLayerDelete({ req, res, runtime, next, body }) {
    try {
      res.setHeader('Content-Type', 'application/x-ndjson')
    } catch (e) { }

    res.write(JSON.stringify({
      route: `${runtime.configuration.method} /routes/${runtime.configuration.path}`,
      key: req.client.key,
      principal: script.principal.email,
      firstResource: runtime.metadata.resource
    }) + '\n')
    next()
  }

  @route('DELETE c_340_ping', {
    name: 'c_340_delete',
    weight: 1
  })
  static secondLayerDelete({ req, res, runtime, next, body }) {
    res.write(JSON.stringify({
      route: `${runtime.configuration.method} /routes/${runtime.configuration.path}`,
      key: req.client.key,
      principal: script.principal.email,
      secondResource: runtime.metadata.resource
    }) + '\n')

  }

}

module.exports = CustomRoute
