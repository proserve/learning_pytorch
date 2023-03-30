
const { rString } = require('../../../../utils'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules'),
      StringDefinition = require('../types/string-definition')

class UrlDefinition extends StringDefinition {

  constructor(options) {
    super(options)
    this._urlGenerator = options.urlGenerator
  }
  generateUrl(org, template, token) {
    return this._urlGenerator(org, template, token)
  }
  static get mongooseType() {
    return 'String'
  }

}

function makeGenerator(name) {
  return function(org, template, token) {
    if (token) {
      let tpl = rString(template, '') || modules.templates.appUrl(org.code, `/${name}/$token`)
      if (tpl) {
        return tpl.replace('$token', token)
      }
    }
    return ''
  }
}

module.exports = {
  definition: () => ({
    label: 'Urls',
    name: 'urls',
    type: 'Document',
    writable: true,
    acl: acl.Inherit,
    properties: [
      new UrlDefinition({
        label: 'Connection',
        name: 'connection',
        // description: 'A url that may contain {{token}} and {{appKey}} variables, used to create the connection.url property in invitatio email templates.',
        type: 'String',
        default: '',
        writable: true,
        validators: [{
          name: 'url',
          definition: {
            allowNull: false,
            allowEmpty: true
          }
        }, {
          name: 'string',
          definition: { min: 0, max: 1024 }
        }],
        acl: acl.Inherit,
        urlGenerator: makeGenerator('accept-invitation')
      }),
      new UrlDefinition({
        label: 'Reset Password',
        name: 'resetPassword',
        // description: 'A url that may contain {{token}} and {{appKey}} variables, used to create the reset.url property in the password reset email template.',
        type: 'String',
        default: '',
        writable: true,
        validators: [{
          name: 'url',
          definition: {
            allowNull: false,
            allowEmpty: true
          }
        }, {
          name: 'printableString',
          definition: { min: 0, max: 1024 }
        }],
        acl: acl.Inherit,
        urlGenerator: makeGenerator('reset-password')
      }),
      new UrlDefinition({
        label: 'Create Password',
        name: 'createPassword',
        // description: 'A url that may contain {{token}} and {{appKey}} variables, used to create the createPassword.url property in the create password email template.',
        type: 'String',
        default: '',
        writable: true,
        validators: [{
          name: 'url',
          definition: {
            allowNull: false,
            allowEmpty: true
          }
        }, {
          name: 'printableString',
          definition: { min: 0, max: 1024 }
        }],
        acl: acl.Inherit,
        urlGenerator: makeGenerator('create-password')
      }),
      new UrlDefinition({
        label: 'Account Activation',
        name: 'activateAccount',
        // description: 'A url that may contain {{token}} and {{appKey}} variables, used to create the createPassword.url property in account activation email templates.',
        type: 'String',
        default: '',
        writable: true,
        validators: [{
          name: 'url',
          definition: {
            allowNull: false,
            allowEmpty: true
          }
        }, {
          name: 'printableString',
          definition: { min: 0, max: 1024 }
        }],
        acl: acl.Inherit,
        urlGenerator: makeGenerator('activate-account')
      }),
      new UrlDefinition({
        label: 'Account Verification',
        name: 'verifyAccount',
        // description: 'A url that may contain {{token}} and {{appKey}} variables, used to create the createPassword.url property in account verification email templates.',
        type: 'String',
        default: '',
        writable: true,
        validators: [{
          name: 'url',
          definition: {
            allowNull: false,
            allowEmpty: true
          }
        }, {
          name: 'printableString',
          definition: { min: 0, max: 1024 }
        }],
        acl: acl.Inherit,
        urlGenerator: makeGenerator('verify-account')
      })
    ]
  }
  )
}
