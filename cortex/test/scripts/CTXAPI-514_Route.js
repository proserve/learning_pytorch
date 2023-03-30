const { route } = require('decorators')

class CustomCtxapi514Route {

  @route('GET c_514_objects', { name: 'c_514_objects', weight: 1 })
  getObjectsCtxapi514({ req, res, body }) {
    return org.objects.objects.find().toArray()
  }

}

module.exports = CustomCtxapi514Route
