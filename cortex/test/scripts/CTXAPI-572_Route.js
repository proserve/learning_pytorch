const { route } = require('decorators')

class CustomCtxapi572Route {

  @route({
    method: 'GET',
    name: 'c_ctxapi_572',
    path: 'c_572_ping',
    principal: {
      username: 'francoUsername'
    },
    weight: 1
  })
  postImplCtxapi572({ req, body }) {
    return script.principal
  }

}

module.exports = CustomCtxapi572Route
