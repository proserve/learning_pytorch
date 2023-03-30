
const config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault')

class TemplatesModule {

  constructor() {
    return TemplatesModule
  }

  static appUrl(code, path = '/') {
    return `https://${config('webApp.host')}/${code}${path}`
  }

  static appsDashboardUrl(code, path = '/') {
    return `https://${config('appsDashboard.host')}${path}?org=${code}`
  }

  static apiUrl(code, path = '/') {
    return `https://${config('server.apiHost')}/${code}${path}`
  };

  static getTemplateSpec(type, partial) {

    switch (type) {

      case 'email':

        return partial ? [{
          name: 'partial',
          mime: 'text/html',
          summary: 'Partial Content'
        }] : [{
          'name': 'subject',
          'mime': 'text/plain',
          'summary': 'Email subject'
        }, {
          'name': 'plain',
          'mime': 'text/plain',
          'summary': 'Plain text body'
        }, {
          'name': 'html',
          'mime': 'text/html',
          'summary': 'HTML body'
        }]

      case 'sms':

        return partial ? [{
          name: 'partial',
          mime: 'text/plain',
          summary: 'Partial Content'
        }] : [{
          name: 'message',
          mime: 'text/plain',
          summary: 'Text Message'
        }]

      case 'push':

        return partial ? [{
          name: 'partial',
          mime: 'text/plain',
          summary: 'Partial Content'
        }] : [{
          name: 'message',
          mime: 'text/plain',
          summary: 'Notification Text'
        }]

      case 'html':

        return partial ? [{
          name: 'partial',
          mime: 'text/html',
          summary: 'Partial Content'
        }] : [{
          'name': 'content',
          'mime': 'text/html',
          'summary': 'HTML body'
        }]

      default:

        throw Fault.create('cortex.invalidArgument.unspecified', { path: 'template.type', reason: 'Unsupported template type.' })

    }

  }

}

module.exports = TemplatesModule
