const { route } = require('decorators')

class RoutesObjectCtxapi689 {

  @route('GET c_ctxapi689_get_route', {
    name: 'c_ctxapi689_get_route',
    weight: 1,
    if: { $gt: [{ $toNumber: '$$REQUEST.query.id' }, { $literal: 45 }] }
  })
  static getImplCtx689Routes({ req, res, body }) {
    return 'The get request was executed!'
  }

  @route({
    weight: 1,
    method: 'POST',
    name: 'c_689_post_route',
    path: 'c_689_post_route',
    acl: ['role.administrator'],
    if: { $and: [true, 1, { $toBool: 's' }] }
  })
  postImplCtx689Route({ req, body }) {
    return `The post! The number is ${body('theNumber')}`
  }

}
module.exports = RoutesObjectCtxapi689
