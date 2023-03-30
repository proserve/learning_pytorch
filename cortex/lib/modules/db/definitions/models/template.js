'use strict'

const util = require('util'),
      fs = require('fs'),
      path = require('path'),
      semver = require('semver'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      ap = require('../../../../access-principal'),
      { isSet, isEmpty, promised, sortKeys, array: toArray, naturalCmp, isCustomName, option: getOption,
        joinPaths, path: pathTo, rString, extend, getIdOrNull, equalIds, isId, ensureCallback,
        resolveOptionsCallback, isInteger, createId, isPlainObject, isEmptyArray
      } = require('../../../../utils'),
      { ArrayOutputCursor } = require('cortex-service/lib/utils/output'),
      acl = require('../../../../acl'),
      async = require('async'),
      consts = require('../../../../consts'),
      ModelDefinition = require('../model-definition'),
      DocumentDefinition = require('../types/document-definition'),
      modules = require('../../../../modules'),
      Handlebars = require('handlebars'),
      AsyncHandlebars = require('handlebars-async-helpers')(Handlebars),
      moment = require('moment'),
      crypto = require('crypto'),
      expression = require('../../../expressions'),
      { AccessContext } = require('../../../../acl'),
      templateDir = `${__dirname}/../../../../../i8ln/templates`,
      MAX_TEMPLATE_VERSIONS = 10,
      VALID_CONTENT_TYPES = ['application/json', 'text/plain', 'text/css', 'text/html', 'text/x-markdown'],
      TYPE_REGEX = /^[a-z0-9\-_]+$/i,
      NAME_REGEX = /^[a-z0-9\-_ :?*/]*$/i

// @todo: expand roles to include template editors. or perhaps add roles to the templates themselves?
// @todo: allow creation of specs
// @todo: implement 'reset' template to original content.
// @todo make sure specs have paths when the type is model or object.
// @todo: add revisions to changes schema to prevent overwriting changes.
// @todo: add 'register variable' functionality so we can have other modules add variable types.

let Undefined

function compilerVersion() {
  return `${semver.major(AsyncHandlebars.VERSION)}.${semver.minor(AsyncHandlebars.VERSION)}.x`
}

function isNotWildcardLocale(locale) {
  return locale !== '*' && (Array.isArray(locale) && locale[0] !== '*')
}

function getCanonicalLocales(locales) {
  if (typeof locales === 'string') {
    locales = locales.split(',').map(v => v.trim()).filter(v => v)
  }
  return Intl.getCanonicalLocales(
    toArray(locales, true).map(v => String(v).replace(/_/g, '-'))
  )
}

AsyncHandlebars.registerHelper('IntlDateTimeFormat', function(...params) {

  const { hash, data } = params[params.length - 1],
        param1 = params.length > 1 ? params[0] : new Date(),
        param2 = params.length > 2 ? params[1] : Undefined,
        command = params.length > 2 ? 'formatRange' : 'format',
        locales = getCanonicalLocales(hash.locales || hash.locale || data.locale),
        options = _.pick(hash, 'dateStyle', 'timeStyle', 'calendar', 'dayPeriod', 'numberingSystem', 'localeMatcher',
          'timeZone', 'hourCycle', 'formatMatcher', 'weekday', 'era', 'year', 'month', 'day', 'hour', 'minute',
          'second', 'fractionalSecondDigits', 'timeZoneName')

  return new Intl.DateTimeFormat(locales, options)[command](param1, param2)
})

AsyncHandlebars.registerHelper('IntlNumberFormat', function(...params) {

  const { hash, data } = params[params.length - 1],
        param1 = params.length > 1 ? params[0] : new Date(),
        locales = getCanonicalLocales(hash.locales || hash.locale || data.locale),
        options = _.pick(hash, 'compactDisplay', 'currency', 'currencyDisplay', 'currencySign', 'localeMatcher', 'notation', 'numberingSystem',
          'signDisplay', 'style', 'unit', 'unitDisplay', 'useGrouping', 'minimumIntegerDigits', 'minimumFractionDigits',
          'maximumFractionDigits', 'minimumSignificantDigits', 'maximumSignificantDigits')

  return new Intl.NumberFormat(locales, options).format(param1)
})

AsyncHandlebars.registerHelper('IntlListFormat', function(...params) {

  const { hash, data } = params[params.length - 1],
        param1 = params.length > 1 ? params[0] : [],
        locales = getCanonicalLocales(hash.locales || hash.locale || data.locale),
        options = _.pick(hash, 'localeMatcher', 'type', 'style')

  return new Intl.ListFormat(locales, options).format(toArray(param1, isSet(param1)).map(v => String(v)))
})

AsyncHandlebars.registerHelper('IntlRelativeTimeFormat', function(...params) {

  const { hash, data } = params[params.length - 1],
        param1 = params.length > 1 ? params[0] : Undefined,
        param2 = params.length > 2 ? params[1] : Undefined,
        locales = getCanonicalLocales(hash.locales || hash.locale || data.locale),
        options = _.pick(hash, 'localeMatcher', 'numeric', 'style')

  return new Intl.RelativeTimeFormat(locales, options).format(param1, param2)
})

// noinspection JSUnresolvedFunction
AsyncHandlebars.registerHelper({
  extend: function(partial, options) {
    let context = this,
        // noinspection JSUnresolvedVariable
        template = AsyncHandlebars.partials[partial] || pathTo(options.data.partials, partial)

    // Partial template required
    if (typeof template === 'undefined') {
      throw new Error("Missing layout partial: '" + partial + "'")
    }

    // Parse blocks and discard output
    options.fn(context)

    if (!_.isFunction(template)) {
      template = AsyncHandlebars.compile(template)
    }

    // Render final layout partial with revised blocks
    return template(context, options)
  },
  append: function(block, options) {
    this.blocks = this.blocks || {}
    this.blocks[block] = {
      should: 'append',
      fn: options.fn
    }
  },
  prepend: function(block, options) {
    this.blocks = this.blocks || {}
    this.blocks[block] = {
      should: 'prepend',
      fn: options.fn
    }
  },
  replace: function(block, options) {
    this.blocks = this.blocks || {}
    this.blocks[block] = {
      should: 'replace',
      fn: options.fn
    }
  },
  block: function(name, options) {
    this.blocks = this.blocks || {}
    let block = this.blocks[name]
    switch (block && block.fn && block.should) {
      case 'append':
        return options.fn(this) + block.fn(this)
      case 'prepend':
        return block.fn(this) + options.fn(this)
      case 'replace':
        return block.fn(this)
      default:
        return options.fn(this)
    }
  }
})

AsyncHandlebars.registerHelper('lngDir', async function(options) {
  const { data: { ctx: { principal }, locale } } = options,
        org = await promised(modules.db.models.org, 'loadOrg', principal.org._id)
  return org.i18n.dir(org, locale)
})

AsyncHandlebars.registerHelper('stringify', function(context) {
  return JSON.stringify(context)
})

AsyncHandlebars.registerHelper('i18n', async function(context, options) {
  const { hash, data: { ctx: { principal }, locale } } = options
  // eslint-disable-next-line one-var
  const org = await promised(modules.db.models.org, 'loadOrg', principal.org._id)
  try {
    if (!org.i18n.loaded) {
      await org.i18n.load(org)
    }
    let value = await org.i18n.translate(new AccessContext(ap.synthesizeAnonymous(org)), context, { locale, pseudo: { enabled: false } })
    if (value) {
      const tpl = AsyncHandlebars.compile(value),
            translated = await tpl(hash)
      value = modules.i18n.pseudoTranslate(principal.org, translated)
    }
    return options.fn ? options.fn(value) : value
  } catch (ex) {
    logger.error(`There was an error trying to translate ${context}`, ex)
    return null
  }
})

/**
 * uses moment date formatting.
 *
 * {{formatDate 1970-01-01 yyyy-mm-dd}}
 * {{formatDate yyyy-mm-dd}}
 */
AsyncHandlebars.registerHelper('formatDate', function() {
  let len = arguments.length - 1, datetime = len > 1 ? arguments[0] : new Date(), format = arguments[len === 1 ? 0 : 1]
  return moment(datetime).format(format)
})

/**
 *
 */
AsyncHandlebars.registerHelper('fullname', function(name) {
  if (name && (_.isString(name.first) || _.isString(name.last))) {
    return (rString(name.first, '') + ' ' + rString(name.last, '')).trim()
  }
  return 'Someone'
})

/**
 * add the org logo.
 * {{orgLogo "thumbnail"}}
 * {{orgLogo}}
 */
AsyncHandlebars.registerHelper('orgLogo', function() {

  let options = {},
      idx = arguments.length,
      args,
      org,
      facetName,
      facetPath,
      file

  while (idx-- > 1) {
    if (arguments[idx] !== undefined) {
      options = arguments[idx]
      break
    }
  }
  args = Array.prototype.slice.call(arguments, 0, idx)
  org = pathTo(options, 'data.ctx.principal.org')
  facetName = args[0] || 'content'
  file = pathTo(org, 'logo')

  if (facetName === 'content') {
    facetPath = pathTo(file, 'path')
  } else {
    const facet = _.find(toArray(pathTo(file, 'facets')), function(facet) { return facet.name === facetName })
    if (facet) {
      facetPath = facet.path
    }
  }
  if (!facetPath) {
    return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
  }
  return modules.templates.apiUrl(org.code, facetPath)

})

/**
 *
 * {{urlFor "login"}}
 * {{urlFor "file" fileObject "facet"}}
 *
 */
AsyncHandlebars.registerHelper('urlFor', function() {

  let options = {},
      idx = arguments.length,
      type = arguments[0],
      args,
      orgCode

  while (idx-- > 1) {
    if (arguments[idx] !== undefined) {
      options = arguments[idx]
      break
    }
  }

  args = Array.prototype.slice.call(arguments, 1, idx)
  orgCode = pathTo(options, 'data.ctx.principal.org.code')

  switch (type) {

    case 'login':

      if (orgCode) {

        if (this.newLoginExperience) {

          if (this.ssoOnly) {
            return modules.templates.appsDashboardUrl(orgCode)
          }
          return modules.templates.appsDashboardUrl(orgCode, `/create-password/${this.passwordResetToken}`)
        }
        return modules.templates.appUrl(orgCode, '/sign-in')
      }
      break

    case 'file':

      if (orgCode) {

        let file = args[0],
            facetName = args[1] || 'content',
            facetPath

        if (facetName === 'content') {
          facetPath = pathTo(file, 'path')
        } else {
          let facet = _.find(toArray(pathTo(file, 'facets')), function(facet) { return facet.name === facetName })
          if (facet) {
            facetPath = facet.path
          }
        }
        if (!facetPath) {
          return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
        }
        return modules.templates.apiUrl(orgCode, facetPath)
      }
      break

  }
  return ''
})

AsyncHandlebars.registerHelper('expression', async function(expr, options) {
  const org = await promised(modules.db.models.org, 'loadOrg', this.principal.org._id),
        ac = new AccessContext(ap.synthesizeAccount({ ...this.principal, org }), null)

  if (Array.isArray(expr)) {
    // is a pipeline
    const exp = expression.createPipeline(ac, expr, { '$$ROOT': options.context }),
          expResult = await exp.evaluate()
    let result = [],
        hasNext = await promised(expResult, 'hasNext')
    while (hasNext) {
      const item = await promised(expResult, 'next')
      hasNext = await promised(expResult, 'hasNext')
      result.push(item)
    }
    return result
  } else if (isPlainObject(expr) || typeof expr === 'string') {
    // is a single expression
    const value = isPlainObject(expr) ? expr : { $expression: expr },
          exp = expression.createContext(ac, value, { '$$ROOT': options.context }),
          result = await exp.evaluate()
    return options.fn(result)
  }
  return null
})

function hashContent(content) {

  // sort the content array by name, then hash the content data.
  var shasum = crypto.createHash('sha1')
  content.sort(function(a, b) { return a.name - b.name })
  content.forEach(function(v) {
    shasum.update(v.data)
  })
  return shasum.digest('hex')
}

function TemplateContentDefinition(options) {

  options.properties = [
    {
      label: 'Name',
      name: 'name',
      type: 'String',
      validators: [{
        name: 'pattern',
        definition: {
          pattern: '/^[a-zA-Z0-9-_]{1,40}$/'
        }
      }]
    },
    {
      label: 'Mime',
      name: 'mime',
      type: 'String',
      validators: [{
        name: 'stringEnum',
        definition: {
          values: VALID_CONTENT_TYPES
        }
      }]
    },
    {
      label: 'Data',
      name: 'data',
      type: 'String',
      default: '',
      validators: [{
        name: 'string',
        definition: {
          min: 0,
          max: 1024 * 100
        }
      }]
    },
    {
      label: 'Includes',
      name: 'includes',
      type: 'Document',
      array: true,
      properties: [
        {
          label: 'Type',
          name: 'type',
          type: 'String',
          validators: [{
            name: 'required'
          }, {
            name: 'stringEnum',
            definition: {
              values: ['partial', 'layout']
            }

          }]
        },
        {
          label: 'Name',
          name: 'name',
          type: 'String',
          validators: [{
            name: 'required'
          }]
        },
        {
          label: 'Version',
          name: 'version',
          type: 'Number'
        }
      ]
    }
  ]

  DocumentDefinition.call(this, options)

}

util.inherits(TemplateContentDefinition, DocumentDefinition)

// -----------------------------------------------------------------------

function TemplateDefinition() {

  this._id = TemplateDefinition.statics._id
  this.objectId = TemplateDefinition.statics.objectId
  this.objectLabel = TemplateDefinition.statics.objectLabel
  this.objectName = TemplateDefinition.statics.objectName
  this.pluralName = TemplateDefinition.statics.pluralName

  var options = {

    label: 'Template',
    name: 'template',
    _id: consts.NativeModels.template,
    pluralName: 'templates',

    properties: [
      {
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        auto: true
      },
      {
        label: 'Org',
        name: 'org',
        type: 'ObjectId'
      },
      {
        label: 'Locale',
        name: 'locale',
        type: 'String',
        array: true,
        maxItems: -1,
        validators: [{
          name: 'locale',
          definition: {
            allowNull: true,
            allowStar: true
          }
        }, {
          name: 'uniqueInArray'
        }]
      },
      {
        label: 'Unique Identifier',
        name: 'uniqueIdentifier',
        type: 'String',
        validators: [{
          name: 'uniqueInArray'
        }]
      },
      {
        label: 'Type',
        name: 'type',
        type: 'String',
        validators: [{
          name: 'stringEnum',
          definition: {
            values: ['email', 'push', 'sms', 'html']
          }
        }]
      },
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        validators: [{
          name: 'customName',
          definition: {
            min: 1,
            max: 40,
            skip: function() {
              return this.builtin
            }
          }
        }]
      },
      {
        label: 'Builtin',
        name: 'builtin',
        type: 'Boolean',
        default: false,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Spec',
        name: 'spec',
        type: 'Document',
        array: true,
        properties: [
          {
            label: 'Nickname',
            name: 'nickname',
            type: 'String',
            validators: [{
              name: 'string',
              definition: {
                min: 1,
                max: 100
              }
            }]
          },
          {
            label: 'Summary',
            name: 'summary',
            type: 'String',
            validators: [{
              name: 'string',
              definition: {
                min: 0,
                max: 255
              }
            }]
          },
          {
            label: 'Content',
            name: 'content',
            type: 'Document',
            array: true,
            properties: [
              {
                label: 'Name',
                name: 'name',
                type: 'String',
                validators: [{
                  name: 'string',
                  definition: {
                    min: 0,
                    max: 40
                  }
                }]
              },
              {
                label: 'mime',
                name: 'mime',
                type: 'String',
                validators: [{
                  name: 'stringEnum',
                  definition: {
                    values: VALID_CONTENT_TYPES
                  }
                }]
              },
              {
                label: 'Summary',
                name: 'summary',
                type: 'String',
                validators: [{
                  name: 'string',
                  definition: {
                    min: 0,
                    max: 255
                  }
                }]
              }
            ]
          },
          {
            label: 'Variables',
            name: 'variables',
            type: 'Document',
            array: true,
            properties: [
              {
                label: 'Name',
                name: 'name',
                type: 'String',
                validators: [{
                  name: 'pattern',
                  definition: {
                    pattern: '/^[a-zA-Z0-9-_]{1,40}$/'
                  }
                }]
              },
              {
                label: 'Type',
                name: 'type',
                type: 'String',
                validators: [{
                  name: 'stringEnum',
                  definition: {
                    values: Object.keys(TemplateDefinition.statics.VariableTypes)
                  }
                }]
              },
              {
                label: 'Object',
                name: 'object',
                type: 'String',
                validators: [{
                  name: 'pattern',
                  definition: {
                    pattern: '/^[a-zA-Z0-9-_]{1,40}$/'
                  }
                }]
              },
              {
                label: 'Paths',
                name: 'paths',
                type: 'String',
                array: true,
                validators: [{
                  name: 'pattern',
                  definition: {
                    pattern: '/^[a-zA-Z0-9-_\\.]{1,255}$/'
                  }
                }]
              },
              {
                label: 'Summary',
                name: 'summary',
                type: 'String',
                validators: [{
                  name: 'string',
                  definition: {
                    min: 0,
                    max: 255
                  }
                }]
              }
            ]
          }
        ]
      },
      {
        label: 'Changes',
        name: 'changes',
        type: 'Document',
        array: true,
        properties: [
          {
            label: 'Ordinal',
            name: 'ordinal',
            type: 'Any',
            serializeData: false
          },
          {
            label: 'Version',
            name: 'version',
            type: 'Number'
          },
          {
            label: 'Created',
            name: 'created',
            type: 'Document',
            array: false,
            properties: [
              {
                label: 'By',
                name: 'by',
                type: 'ObjectId',
                ref: 'account',
                validators: [
                  {
                    name: 'required'
                  }
                ]
              },
              {
                label: 'At',
                name: 'at',
                type: 'Date',
                validators: [
                  {
                    name: 'required'
                  }
                ]
              }
            ]
          },
          {
            label: 'Updated',
            name: 'updated',
            type: 'Document',
            array: false,
            properties: [
              {
                label: 'By',
                name: 'by',
                type: 'ObjectId',
                ref: 'account'
              },
              {
                label: 'At',
                name: 'at',
                type: 'Date'
              }
            ]
          },
          {
            label: 'SHA1',
            name: 'sha1',
            type: 'String',
            validators: [
              {
                name: 'required'
              }
            ]
          },
          new TemplateContentDefinition({
            label: 'Content',
            name: 'content',
            array: true
          })
        ]
      },
      {
        label: 'Version',
        name: 'version',
        type: 'Number',
        default: 0,
        validators: [
          {
            name: 'required'
          }
        ]
      },
      {
        label: 'Current',
        name: 'current',
        type: 'Document',
        array: false,
        properties: [
          {
            label: 'Version',
            name: 'version',
            type: 'Number',
            default: 0,
            validators: [
              {
                name: 'required'
              }
            ]
          },
          new TemplateContentDefinition({
            label: 'Content',
            name: 'content',
            array: true
          }),
          {
            label: 'Compiled',
            name: 'compiled',
            type: 'Document',
            array: false,
            properties: [
              {
                label: 'Dirty',
                name: 'dirty',
                type: 'Boolean'
              },
              {
                label: 'Includes',
                name: 'includes',
                type: 'Document',
                array: true,
                properties: [
                  {
                    label: 'Name',
                    name: 'name',
                    type: 'String'
                  },
                  {
                    label: 'Versions',
                    name: 'versions',
                    type: 'Number',
                    array: true
                  },
                  {
                    label: 'Data',
                    name: 'data',
                    type: 'String'
                  },
                  {
                    label: 'Compiler Version',
                    name: 'compiler_version',
                    type: 'String'
                  },
                  {
                    label: 'Async Compiler Version',
                    name: 'async_compiler_version',
                    type: 'String'
                  }
                ]
              },
              {
                label: 'Variables',
                name: 'variables',
                type: 'Document',
                array: true,
                properties: [
                  {
                    label: 'Name',
                    name: 'name',
                    type: 'String'
                  },
                  {
                    label: 'Type',
                    name: 'type',
                    type: 'String'
                  },
                  {
                    label: 'Object',
                    name: 'object',
                    type: 'String'
                  },
                  {
                    label: 'Paths',
                    name: 'paths',
                    type: 'String',
                    array: true
                  }
                ]
              },
              {
                label: 'Content',
                name: 'content',
                type: 'Document',
                array: true,
                properties: [
                  {
                    label: 'Name',
                    name: 'name',
                    type: 'String'
                  },
                  {
                    label: 'Data',
                    name: 'data',
                    type: 'String'
                  }
                ]
              },
              {
                label: 'Compiler Version',
                name: 'compiler_version',
                type: 'String'
              },
              {
                label: 'Async Compiler Version',
                name: 'async_compiler_version',
                type: 'String'
              }
            ]
          }
        ]
      },
      {
        label: 'Sequence',
        name: 'sequence',
        type: 'Number',
        default: 0
      },
      {
        label: 'Updated',
        name: 'updated',
        type: 'Document',
        array: false,
        properties: [
          {
            label: 'By',
            name: 'by',
            type: 'ObjectId',
            ref: 'account'
          },
          {
            label: 'At',
            name: 'at',
            type: 'Date'
          }
        ]
      }
    ]
  }

  ModelDefinition.call(this, options)
}
util.inherits(TemplateDefinition, ModelDefinition)

TemplateDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = TemplateDefinition.statics
  options.methods = TemplateDefinition.methods
  options.indexes = TemplateDefinition.indexes
  options.options = extend({
    versionKey: 'sequence'
  }, options.options)
  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

TemplateDefinition.statics = {

  _id: consts.NativeModels.template,
  objectId: consts.NativeModels.template,
  objectLabel: 'Template',
  objectName: 'template',
  pluralName: 'templates',
  requiredAclPaths: ['_id', 'org', 'object', 'sequence'],
  Handlebars: AsyncHandlebars,
  VariableTypes: {

    schema: {
      load: loadVariable(function(principal, schemaName, options, callback) {
        modules.schemas.getSchema(principal.org, schemaName, { asObject: true }, function(err, schema) {
          callback(err, schema)
        })
      })
    },

    object: { // principal accessible object options must include the object.
      load: loadVariable(function(principal, contextId, options, callback) {

        var Account = modules.db.models.account,
            Org = modules.db.models.org

        principal.org.createObject(options.object, function(err, object) {
          if (err) {
            callback(err)
            return
          }
          contextId = isEmpty(contextId) ? null : getIdOrNull(contextId, true)
          if (contextId === null) {
            if (equalIds(Account._id, pathTo(object, '_id'))) contextId = principal._id
            else if (equalIds(Org._id, pathTo(object, '_id'))) contextId = principal.orgId
            else {
              callback(Fault.create('cortex.invalidArgument.unspecified'), 'objectId')
              return
            }
          }
          object.aclReadOne(principal, contextId, { req: options.req, paths: options.paths }, function(err, document) {
            callback(err, document)
          })
        })

      })
    },

    post: { // principal accessible post
      load: loadVariable(function(principal, postId, options, callback) {
        postId = getIdOrNull(postId, true)
        if (!postId) {
          callback(Fault.create('cortex.invalidArgument.unspecified'), 'postId')
          return
        }

        var readOpts = {
          expand: ['creator', 'context'],
          req: options.req,
          trackViews: false,
          clearNotifications: false,
          json: true
        }

        modules.db.models.Post.postReadOne(principal, postId, readOpts, function(err, post) {
          callback(err, post)
        })
      })
    },

    comment: { // principal accessible comment
      load: loadVariable(function(principal, commentId, options, callback) {
        commentId = getIdOrNull(commentId, true)
        if (!commentId) {
          callback(Fault.create('cortex.invalidArgument.unspecified'), 'commentId')
          return
        }

        modules.db.models.Post.postReadOne(principal, commentId, { clearNotifications: false, trackViews: false, isComment: true, json: false, paths: ['_id'] }, function(err, post, pac) {
          if (err) {
            callback(err)
            return
          }

          var readOpts = {
            expand: ['creator'],
            trackViews: false,
            clearNotifications: false,
            json: true
          }

          modules.db.models.Comment.commentReadOne(pac, commentId, readOpts, function(err, document) {
            callback(err, document)
          })

        })

      })
    },

    connection: { // principal involved connection  (token)
      load: loadVariable(function(principal, connectionId, options, callback) {
        if (!isId(connectionId)) {
          callback(Fault.create('cortex.invalidArgument.unspecified'), 'connectionId')
          return
        }
        modules.db.models.Connection.loadConnection(principal, connectionId, { includeKey: true, includeUrl: true, includeToken: true, skipAcl: true, expand: ['creator'] }, function(err, connection) {
          callback(err, connection)
        })
      })
    },

    activation: { // (token)
      load: loadVariable(function(principal, token, options, callback) {

        if (!_.isString(token) || token.length === 0) {
          callback(Fault.create('cortex.invalidArgument.unspecified'), 'token')
          return
        }

        var Callback = modules.db.models.callback

        Callback.findOne({ token: token, handler: consts.callbacks.act_acct, org: principal.orgId }).lean().exec(function(err, callbackObject) {
          if (!err && !callbackObject) {
            err = Fault.create('cortex.notFound.unspecified', 'activation')
          }
          if (!err) {
            callbackObject = {
              token: callbackObject.token,
              state: callbackObject.state,
              target: callbackObject.target,
              url: principal.org.generateEmailUrl('activateAccount', callbackObject.token, callbackObject.clientKey)
            }
          }
          callback(err, callbackObject)
        })
      })
    },

    createPassword: { // (token)
      load: loadVariable(function(principal, token, options, callback) {

        if (!_.isString(token) || token.length === 0) {
          callback(Fault.create('cortex.invalidArgument.unspecified'), 'token')
          return
        }

        var Callback = modules.db.models.callback

        Callback.findOne({ token: token, handler: consts.callbacks.pass_reset, org: principal.orgId }).lean().exec(function(err, callbackObject) {
          if (!err && !callbackObject) {
            err = Fault.create('cortex.notFound.unspecified', 'createPassword')
          }
          if (!err) {
            callbackObject = {
              token: callbackObject.token,
              state: callbackObject.state,
              target: callbackObject.target,
              url: principal.org.generateEmailUrl('createPassword', callbackObject.token, callbackObject.clientKey)
            }
          }
          callback(err, callbackObject)
        })
      })
    },

    passwordReset: { // (token)
      load: loadVariable(function(principal, token, options, callback) {
        if (!_.isString(token) || token.length === 0) {
          callback(Fault.create('cortex.invalidArgument.unspecified'), 'token')
          return
        }

        var Callback = modules.db.models.callback

        Callback.findOne({ token: token, handler: consts.callbacks.pass_reset, org: principal.orgId }).lean().exec(function(err, callbackObject) {
          if (!err && !callbackObject) {
            err = Fault.create('cortex.notFound.unspecified', 'passwordReset')
          }
          if (!err) {
            callbackObject = {
              token: callbackObject.token,
              state: callbackObject.state,
              target: callbackObject.target,
              url: principal.org.generateEmailUrl('resetPassword', callbackObject.token, callbackObject.clientKey)
            }
          }
          callback(err, callbackObject)
        })
      })
    },

    verification: { // (token)
      load: loadVariable(function(principal, token, options, callback) {
        if (!_.isString(token) || token.length === 0) {
          callback(Fault.create('cortex.invalidArgument.unspecified'), 'token')
          return
        }

        var Callback = modules.db.models.callback

        Callback.findOne({ token: token, handler: consts.callbacks.ver_acct, org: principal.orgId }).lean().exec(function(err, callbackObject) {
          if (!err && !callbackObject) {
            err = Fault.create('cortex.notFound.unspecified', 'verification')
          }
          if (!err) {
            callbackObject = {
              token: callbackObject.token,
              state: callbackObject.state,
              target: callbackObject.target,
              url: principal.org.generateEmailUrl('verifyAccount', callbackObject.token, callbackObject.clientKey)
            }
          }
          callback(err, callbackObject)
        })
      })
    },

    principal: { // the calling principal
      load: loadVariable(function(principal, unused, options, callback) {
        principal.toJSON({ req: options.req, inspectAccess: false, accessLevel: acl.AccessLevels.Public }, function(err, doc) {
          callback(err, doc)
        })
      })
    },

    input: { // echoed input (input)
      load: loadVariable(function(principal, input, options, callback) {
        callback(null, input)
      })
    }
  },

  // @todo: better error responses
  // @todo: validate context paths
  validateSpec: function(data) {
    let i, j, entry, type, out
    if (!data) return false
    if (!_.isString(data.nickname) || data.nickname.length === 0) return false
    if (!_.isString(data.summary) || data.summary.length === 0) return false
    if (!_.isArray(data.content) || data.content.length === 0) return false
    i = data.content.length
    while (i--) {
      entry = data.content[i]
      if (!_.isObject(entry)) return false
      if (!_.isString(entry.name) || entry.name.length === 0) return false
      if (VALID_CONTENT_TYPES.indexOf(entry.mime) === -1) return false
      if (!_.isString(entry.summary) || entry.summary.length === 0) return false
    }
    if (data.variables !== undefined) {
      if (!_.isArray(data.variables)) return false
      else {
        i = data.variables.length
        while (i--) {
          entry = data.variables[i]
          if (!_.isString(entry.name) || entry.name.length === 0) return false
          if (!_.isString(entry.summary) || entry.summary.length === 0) return false
          type = this.VariableTypes[entry.type]
          if (!type) return false
          if (entry.type === 'object') {
            var object = entry.object
            if ((object != null && !consts.NativeIds[object]) && !consts.NativeIds[entry.name]) return false
          }
          if (entry.paths !== undefined) {
            if (!_.isArray(entry.paths)) return false
            j = entry.paths.length
            while (j--) {
              if (!_.isString(entry.paths[j]) || entry.paths[j] === 0) return false
            }
          }
        }
      }
    }

    out = {
      nickname: data.nickname,
      summary: data.summary,
      content: data.content.map(function(entry) {
        return {
          name: entry.name,
          mime: entry.mime,
          summary: entry.summary
        }
      })
    }

    if (data.variables !== undefined) {
      out.variables = data.variables.map(function(entry) {
        var out = {
          name: entry.name,
          type: entry.type,
          summary: entry.summary
        }
        if (entry.type === 'object') {
          out.object = entry.object || entry.name
        }
        if (entry.paths !== undefined) {
          out.paths = entry.paths
        }
        return out
      })
    }
    return out

  },

  findContentIncludes: function(entry) {

    // find all the embeds and partials required by this
    let includes = [],
        regex = /\{\{(>\s*|#extend\s+)"?(([a-z0-9\-_]+)(:([0-9]+)?)?)"?\}\}/g,
        matches = regex.exec(entry.data)

    while (matches) {
      let include = {
            type: matches[1] === '>' ? 'partial' : 'layout',
            name: matches[3]
          },
          dupe = false

      if (isSet(matches[5])) {
        include.version = parseInt(matches[5])
      }

      // don't add duplicates.
      includes.forEach(function(inc) {
        if (!dupe && inc.type === include.type && inc.name === include.name && inc.version === include.version) {
          dupe = true
        }
      })
      if (!dupe) {
        includes.push(include)
      }
      matches = regex.exec(entry.data)
    }
    return includes

  },

  validateTemplateContent: function(spec, content) {

    if (!(spec = this.validateSpec(spec))) return false
    if (!_.isArray(content)) return false

    let self = this,
        i = content.length,
        j = spec.content.length,
        entry,
        match,
        matched = []

    if (i !== j) return false

    while (i--) {
      match = null; entry = content[i]
      if (!_.isString(entry.name) || entry.name.length === 0) return false
      if (!_.isString(entry.data)) return false
      j = spec.content.length
      while (j--) {
        if (entry.name === spec.content[j].name) {
          match = entry.name
          if (matched.indexOf(match) === -1) matched.push(match)
          else return false // duplicate;
          break
        }
      }
      if (!match) return false
    }
    if (matched.length !== spec.content.length) return false

    return content.map(function(entry) {
      const out = {
              name: entry.name,
              data: entry.data,
              mime: _.find(spec.content, function(v) { return v.name === entry.name }).mime
            },
            includes = self.findContentIncludes(entry)
      if (includes.length > 0) {
        out.includes = includes
      }
      return out

    })

  },

  /**
     * @param principal
     * @param locale
     * @param type
     * @param name
     * @param content
     * @param {(object|function)=} options
     * @param {function=} callback err -> { includes: includes, variables: variable }
     */
  precompile: function(principal, locale, type, name, content, options, callback) {

    let Template = this

    if (_.isFunction(options)) {
      callback = options
      options = null
    }
    // noinspection JSUnusedAssignment
    options = extend({

    }, options)

    async.waterfall([

      // load dependencies.
      function(callback) {

        let includes = [],
            noneFound = false

        content.forEach(function(entry) {
          toArray(entry.includes).forEach(function(include) {
            if (!_.find(includes, function(i) { return i.name === include.name && isSet(include.version) ? i.version === include.version : i.version === null })) {
              includes.push({
                name: include.name,
                version: isEmpty(include.version) ? null : include.version
              })
            }
          })
        })

        async.whilst(

          function() {
            return includes.some(function(i) { return isEmpty(i.data) })
          },

          async() => {

            // prevent multiple passes.
            if (noneFound) {
              let missing = includes.filter(i => isEmpty(i.data)).map(i => i.name)
              throw Fault.create('cortex.notFound.unspecified', `A required include was not found: ${locale}.${type}[${missing}].`)
            }
            noneFound = true

            // load content still missing.
            // load content relying on the 'current' version. we may just fill in any pinned versions this way without having to look them up.

            let current = includes.filter(i => isEmpty(i.data) && isEmpty(i.version)),
                pinned,
                alike,
                doc
            const loc = Array.isArray(locale) ? { $in: locale } : locale
            if (current.length !== 0) {
              const docs = await Template.find({ org: principal.orgId, locale: loc, type: type, name: { $in: current.map(function(i) { return i.name }) } }).lean().select({ name: 1, 'current.version': 1, 'current.content': 1 }).exec()
              if (docs.length === 0) {
                throw Fault.create('cortex.notFound.unspecified', `A required include was not found: ${locale}.${type}[${current.map(function(i) { return i.name })}].`)
              }

              for (const doc of docs) {

                if (toArray(doc.current.content).length !== 1) {
                  throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Cannot include a template that has more than a single content entry, such as a partial or the built-in layout template.' })
                }

                let content = doc.current.content[0]

                for (const version of [null, doc.current.version]) {
                  let entry = includes.find(include => include.name === doc.name && include.version === version)
                  if (entry) {
                    entry.data = content.data
                  } else {
                    includes.push({
                      name: doc.name,
                      version: isEmpty(version) ? null : version,
                      data: content.data
                    })
                    noneFound = false
                  }
                }

                for (const include of toArray(content.includes)) {

                  if (!includes.find(i => include.name === i.name && include.version === i.version)) {
                    includes.push({
                      name: include.name,
                      version: isEmpty(include.version) ? null : include.version
                    })
                    noneFound = false
                  }
                }

              }

            }

            // load any specifically pinned content versions. do this one batch of names at a time in order to possibly reduce the number of total calls.
            pinned = includes.filter(function(i) { return isEmpty(i.data) && isSet(i.version) })
            if (pinned.length !== 0) {

              alike = pinned.filter(function(i) { return i.name === pinned[0].name })

              doc = await Template.findOne({ org: principal.orgId, locale: loc, type: type, name: pinned[0].name }).lean().select({ name: 1, 'current.version': 1, changes: { $elemMatch: { version: { $in: alike.map(function(i) { return i.version }) } } } }).exec()

              if (!doc || !doc.changes || doc.changes.length === 0) {
                throw Fault.create('cortex.notFound.unspecified', 'include')
              }

              for (const change of doc.changes) {

                if (toArray(change.content).length !== 1) {
                  throw Fault.create('cortex.invalidArgument.unspecified', 'include content length')
                }

                let content = change.content[0]

                for (const version of change.version === doc.current.version ? [null, change.version] : [change.version]) { // add as current as well?

                  let entry = includes.find(include => include.name === doc.name && include.version === version)
                  if (entry) {
                    entry.data = content.data
                  } else {
                    includes.push({
                      name: doc.name,
                      version: isEmpty(version) ? null : version,
                      data: content.data
                    })
                    noneFound = false
                  }
                }

                for (const include of toArray(content.includes)) {

                  if (!includes.find(i => include.name === i.name && include.version === i.version)) {
                    includes.push({
                      name: include.name,
                      version: isEmpty(include.version) ? null : include.version
                    })
                    noneFound = false
                  }
                }
              }

            }

          },
          function(err) {

            // tidy up includes by merging versions of identical data together.
            if (!err) {
              let i, j, a, b
              for (i = 0; i < includes.length; i++) {
                a = includes[i]
                a.versions = toArray(a.version, true)
                delete a.version
                for (j = i + 1; j < includes.length; j++) {
                  b = includes[j]
                  if (a.name === b.name && a.content === b.content) {
                    a.versions.push(b.version)
                    includes.splice(j--, 1)
                  }
                }
              }
            }

            callback(err, includes)
          }
        )
      },

      // load specs for all includes
      function(includes, callback) {

        let names = _.uniq([name].concat(includes.map(function(i) { return i.name })))

        Template.find({ org: principal.orgId, locale: { $in: [ null, [] ] }, type: type, name: { $in: names } }).lean().select({ name: 1, spec: 1 }).exec(function(err, docs) {
          if (err) callback(err)
          else {
            let variables = []
            if (!err) {
              docs.forEach(function(doc) {
                toArray(pathTo(doc, 'spec.0.variables')).forEach(function(v) {
                  let entry = _.find(variables, function(s) { return s.name === v.name && s.type === v.type })
                  if (entry) {
                    entry.paths = _.uniq(entry.paths.concat(toArray(v.paths)))
                  } else {
                    variables.push({
                      name: v.name,
                      type: v.type,
                      paths: toArray(v.paths)
                    })
                    if (v.type === 'object') {
                      variables[variables.length - 1].object = v.object || v.name
                    }
                  }
                })
              })
            }

            callback(null, {
              includes: includes,
              variables: variables
            })

          }
        })
      },

      // pre-compile source
      function(data, callback) {

        data.dirty = false
        data.content = []
        data.compiler_version = compilerVersion()
        data.async_compiler_version = AsyncHandlebars.ASYNC_VERSION

        let err
        try {
          content.forEach(function(item) {
            data.content.push({
              name: item.name,
              data: AsyncHandlebars.precompile(item.data)
            })
          })
          data.includes.forEach(function(include) {
            include.compiler_version = compilerVersion()
            include.data = AsyncHandlebars.precompile(include.data)
          })
        } catch (e) {
          err = e
        }
        callback(err, data)
      }

    ], callback)

  },

  prepareRenderContext: function(principal, locale, variables, payload, callback) {

    variables = toArray(variables)
    payload = _.isObject(payload) ? payload : {}
    // make sure to include the principal.
    if (!variables.some(function(v) { return v.type === 'principal' })) {
      variables.push({
        name: 'principal',
        type: 'principal',
        paths: []
      })
    }
    let self = this,
        tasks = {}
    toArray(variables).forEach(function(variable) {

      let value = payload[variable.name]
      delete payload[variable.name]

      tasks[variable.name] = function(callback) {
        let registered = self.VariableTypes[variable.type]

        if (registered) {

          let options = {
            paths: variable.paths,
            locale
          }

          // for object types, use the name as the object
          if (variable.type === 'object') {
            options.object = variable.object || variable.name
          }

          registered.load(principal, value, options, function(err, result) {
            if (err) {
              result = Fault.from(err).toJSON()
            } else {

              // limit to paths.
              let paths = toArray(variable.paths)
              if (paths.length > 0) {
                let out = {}
                paths.forEach(function(path) {
                  pathTo(out, path, pathTo(result, path))
                })
                result = out
              }
            }
            callback(null, result)
          })
        } else {
          callback(null, Fault.create('cortex.invalidArgument.unspecified', 'unregistered type').toJSON())
        }
      }
    })

    async.parallel(tasks, function(err, variables) {

      if (!err) {
        // tack on whatever is left.
        extend(variables, payload)
      }
      callback(err, variables)

    })
  },

  /**
     * installs default specs and templates.
     *
     * @param orgId
     * @param {(object|function)=} options
     *      overwrite - false. true to overwrite existing options.
     * @param {function=} callback
     */
  installOrgTemplates: function(orgId, options, callback) {

    let Org = modules.db.models.org,
        self = this

    if (_.isFunction(options)) {
      callback = options
      options = null
    }
    options = extend({
      overwrite: false
    }, options)

    async.waterfall([

      // validate the org
      function(callback) {
        Org.loadOrg(orgId, function(err, org) {
          callback(err, org)
        })
      },

      // load all type specs into json.
      function(org, callback) {

        let principal = ap.synthesizeOrgAdmin(org, acl.SystemAdmin),
            specs = {},
            dir = `${templateDir}/spec`

        fs.readdir(dir, function(err, typeDirs) {
          if (err) callback(err)
          else {

            // find types
            async.eachSeries(typeDirs, function(type, callback) {
              fs.stat(path.join(dir, type), function(err, stats) {
                if (err || !stats.isDirectory()) callback(err)
                else {
                  // find and load spec files for this type.
                  fs.readdir(path.join(dir, type), function(err, specFiles) {
                    if (err) callback(err)
                    else {
                      async.eachSeries(specFiles, function(specFile, callback) {
                        if (path.extname(specFile) === '.json') {
                          fs.readFile(path.join(dir, type, specFile), 'utf8', function(err, spec) {
                            if (!err) {
                              try {
                                spec = JSON.parse(spec)
                                if (!self.validateSpec(spec)) {
                                  err = Fault.create('cortex.error.unspecified', 'invalid spec format ' + path.join(dir, type, specFile))
                                }
                              } catch (e) {
                                err = Fault.create('cortex.error.unspecified', 'spec parse error ' + path.join(dir, type, specFile))
                              }
                              if (err) logger.warn(err.toJSON())
                            }
                            if (!err) {
                              (specs[type] || (specs[type] = {}))[path.basename(specFile, '.json')] = spec
                            }
                            callback(err)
                          })
                        } else {
                          callback()
                        }
                      }, callback)
                    }
                  })
                }
              })
            }, function(err) {
              callback(err, principal, specs)
            })
          }
        })

      },

      // install specs.
      function(principal, specs, callback) {
        async.eachSeries(Object.keys(specs), function(type, callback) {
          async.eachSeries(Object.keys(specs[type]), function(name, callback) {
            self.installTemplateSpec(principal.org, type, name, specs[type][name], { builtin: true, overwrite: options['overwrite'] }, callback)
          }, callback)
        }, function(err) {
          callback(err, principal)
        })
      },

      // load localized templates
      function(principal, callback) {

        let templates = {}, dir = templateDir
        fs.readdir(dir, function(err, localeDirs) {
          if (err) callback(err)
          else {
            // find locales.
            async.eachSeries(localeDirs, function(locale, callback) {
              if (!modules.locale.isValid(locale)) callback()
              else {
                fs.readdir(path.join(dir, locale), function(err, typeDirs) {
                  if (err) callback()
                  else {
                    // find types
                    async.eachSeries(typeDirs, function(type, callback) {
                      fs.readdir(path.join(dir, locale, type), function(err, templateFiles) {
                        if (err) callback()
                        else {
                          async.eachSeries(templateFiles, function(templateFile, callback) {
                            if (path.extname(templateFile) !== '.json') callback()
                            else {
                              fs.readFile(path.join(dir, locale, type, templateFile), 'utf8', function(err, template) {
                                if (err && err.code === 'EISDIR') err = null
                                else if (!err) {
                                  try {
                                    template = JSON.parse(template)
                                    if (!template || !_.isArray(template.content) || template.content.length === 0) {
                                      err = Fault.create('cortex.error.unspecified', 'no template content in ' + path.join(dir, locale, type, templateFile))
                                    } else {
                                      let l = (templates[locale] || (templates[locale] = {}));
                                      (l[type] || (l[type] = {}))[path.basename(templateFile, '.json')] = template
                                    }
                                  } catch (e) {
                                    err = Fault.create('cortex.error.unspecified', 'template parse error ' + path.join(dir, locale, type, templateFile))
                                  }
                                }
                                callback(err)
                              })
                            }
                          }, callback)
                        }
                      })
                    }, callback)
                  }
                })
              }
            }, function(err) {
              callback(err, principal, templates)
            })
          }
        })

      },

      // load templates
      function(principal, templates, callback) {

        async.eachSeries(Object.keys(templates), function(locale, callback) {
          async.eachSeries(Object.keys(templates[locale]), function(type, callback) {

            let templateContent = []
            async.eachSeries(Object.keys(templates[locale][type]), function(name, callback) {

              let dir = templateDir, tasks = [], template = templates[locale][type][name]

              // load any included content from html templates.
              template.content.forEach(function(entry) {
                if (entry && !entry.data && _.isString(entry.include)) {
                  tasks.push(function(callback) {
                    fs.readFile(path.join(dir, locale, type, entry.include), 'utf8', function(err, data) {
                      if (!err) entry.data = data
                      callback()
                    })
                  })
                }
              })
              async.parallel(tasks, function() {
                templateContent.push({
                  name: name,
                  content: template.content
                })
                callback()
              })

            }, function() {

              try {
                templateContent.forEach(function(template) {
                  template.includes = []
                  toArray(template.content).forEach(function(entry) {
                    template.includes = template.includes.concat(self.findContentIncludes(entry))
                  })
                })
              } catch (err) {
                return callback(err)
              }

              // @todo order dependencies better. for now, just install the ones with no deps first.
              templateContent.sort(function(a, b) {
                return a.includes.length - b.includes.length
              })

              // install the template
              async.eachSeries(templateContent, function(template, callback) {
                self.updateTemplate(principal, locale, type, template.name, template.content, { createOnly: true, activate: true, builtin: locale === 'en_US' }, function(err) {
                  if (err && err.errCode === 'cortex.conflict.exists') {
                    logger.info('template ' + principal.orgId.toString() + '/' + path.join(locale, type, template.name) + ' exists. Updating V0', { error: err.toJSON() })
                    self.updateTemplate(principal, locale, type, template.name, template.content, { updateZero: true, activate: false, builtin: locale === 'en_US' }, function(err) {
                      if (err && err.errCode !== 'cortex.conflict.exists') {
                        logger.info('failed to install template ' + principal.orgId.toString() + '/' + path.join(locale, type, template.name), { error: err.toJSON() })
                      }
                      callback()
                    })
                  } else if (err && err.errCode !== 'cortex.conflict.exists') {
                    logger.info('failed to install template ' + principal.orgId.toString() + '/' + path.join(locale, type, template.name), { error: err.toJSON() })
                    callback()
                  } else {
                    callback()
                  }
                })
              }, callback)

            })

          }, callback)
        }, callback)
      }

    ], callback)

  },

  /**
     *
     * @param org
     * @param type
     * @param name
     * @param spec
     * @param options
     *      overwrite - false. true to overwrite existing options.
     *      builtin - false. true if this is a built-in spec that cannot be deleted.
     * @param callback
     */
  installTemplateSpec: function(org, type, name, spec, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let Template = this,
        template

    if (!(spec = this.validateSpec(spec))) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid template spec format' }))
      return
    }
    if (!_.isString(type) || type.length === 0 || !type.match(TYPE_REGEX)) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid spec type' }))
      return
    }
    if (!_.isString(name) || name.length === 0 || !name.match(NAME_REGEX)) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid spec name' }))
      return
    }

    options = extend({
      overwrite: false,
      builtin: false
    }, options)

    template = new Template({
      org: org._id,
      locale: [],
      type: type,
      name: name,
      spec: [spec],
      builtin: options.builtin
    })

    template.validateWithAc(new acl.AccessContext(ap.synthesizeAnonymous(org)), function(err) {
      if (err) callback(err)
      else {
        let data = template.toObject(),
            update = { $setOnInsert: {
              org: data.org,
              locale: data.locale,
              type: data.type,
              name: data.name,
              version: 0
              // sequence: 0
            } }
        if (options.overwrite) {
          update.$set = {
            spec: data.spec,
            builtin: data.builtin
          }
        } else {
          update.$setOnInsert.spec = data.spec
          update.$setOnInsert.builtin = data.builtin
        }
        Template.findOneAndUpdate({ org: org._id, locale: { $in: [ null, [] ] }, type: type, name: name }, update, { upsert: true, returnDocument: 'after' }, function(err, template) {
          callback(err, template)
        })
      }
    })

  },

  /**
     * sets the active version of a template.
     *
     * @param principal
     * @param locale
     * @param type
     * @param name
     * @param version
     * @param callback -> err, template model (incomplete)
     */
  setActiveVersion: function(principal, locale, type, name, version, callback) {

    let Template = this,
        err,
        select,
        tasks

    if (!ap.is(principal)) {
      err = Fault.create('cortex.invalidArgument.unspecified', 'principal')
    } else if (!modules.locale.isValid(locale) && isNotWildcardLocale(locale)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'locale', reason: `invalid locale: ${locale}` })
    } else if (!_.isString(type)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'type', reason: 'string expected' })
    } else if (!_.isString(name)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'name', reason: 'string expected' })
    } else if (!isInteger(version)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'version', reason: 'integer expected' })
    }

    if (err) {
      if (_.isFunction(callback)) callback(err)
      return
    }

    version = parseInt(version)

    select = { _id: 1, sequence: 1, 'current.version': 1, changes: { $elemMatch: { version: version } } }

    tasks = [

      // load the template
      function(callback) {

        Template.findOne({ org: principal.orgId, locale: locale, type: type, name: name }).lean().select(select).exec(function(err, doc) {

          let change = null
          if (!err) {
            if (!doc) {
              err = Fault.create('cortex.notFound.unspecified', 'template')
            } else if (!(change = pathTo(doc, 'changes.0'))) {
              err = Fault.create('cortex.notFound.unspecified', 'version')
            }
          }
          callback(err, doc, change)
        })
      },

      function(doc, change, callback) {

        if (version === pathTo(doc, 'current.version')) {

          const template = new Template({}, select)
          template.init(doc)
          callback(null, template)

        } else {

          Template.precompile(principal, locale, type, name, change.content, function(err, compiled) {

            if (err) {
              return callback(err)
            }

            const find = { _id: doc._id, sequence: doc.sequence },
                  update = {
                    $inc: { sequence: 1 },
                    $set: {
                      current: {
                        version: change.version,
                        content: change.content,
                        compiled: compiled
                      }
                    }
                  }
            Template.findOneAndUpdate(find, update, { upsert: false, returnDocument: 'after' }, function(err, template) {
              if (!err && !template) {
                err = Fault.create('cortex.conflict.sequencing')
              }
              // dirty any templates using this version.
              if (!err) {
                Template.collection.updateMany(
                  { org: principal.orgId, locale: locale, type: type, 'current.compiled.includes': { $elemMatch: { name: name, versions: null } } },
                  { $set: { 'current.compiled.dirty': true } },
                  function() {}
                )
              }

              callback(err, template)
            })

          })

        }
      }
    ]

    // try a few times in case writes are coming in at the same time.
    function run(tasks, triesLeft) {
      async.waterfall(tasks, function(err, template) {
        triesLeft -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : triesLeft
        if (triesLeft) {
          setImmediate(run, tasks, triesLeft)
        } else {
          callback(err, template)
        }
      })
    }
    run(tasks, 10)

  },

  /**
     * updates template content.
     *
     * @param principal the org id to which this template is attached.
     * @param locale
     * @param type the type of template. (eg email)
     * @param name the unique template name.
     * @param content an array containing content matching
     * @param options
     *  edit - null. if set, edits a particular version.
     *  builtin - false. if true, marks new templates as built-in templates(not deletable).
     *  current - the operation will fail if the version does not match the current template version. used as a sequence checker. if an edit version is specified, this value is ignored.
     *  activate - true. set to true to set update as the active version.
     *  createOnly - false. if true, only creates the doc. will not update existing documents. will throw cortex.conflict.exists
     * @param callback -> err, template model (incomplete)
     */
  updateTemplate: function(principal, locale, type, name, content, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let err,
        self = this,
        Template = this,
        templateSpec = null,
        select = { _id: 1, builtin: 1, locale: 1, sequence: 1, 'current.content': 1, 'current.version': 1, version: 1, 'changes.sha1': 1, 'changes.version': 1 },
        tasks

    options = extend({
      builtin: false,
      version: null,
      current: null,
      edit: null,
      activate: false,
      createOnly: false,
      updateZero: false, // special case to allow for editing and creation at version 0
      locale: locale
    }, options)

    if (options.updateZero) {
      options.edit = 0
      options.createOnly = false
    }

    if (!ap.is(principal)) {
      err = Fault.create('cortex.invalidArgument.unspecified', 'principal')
    } else if (!modules.locale.isValid(options.locale) && isNotWildcardLocale(options.locale)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'locale', reason: `invalid locale: ${locale}` })
    } else if (!_.isString(type)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'type', reason: 'string expected' })
    } else if (!_.isString(name)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'name', reason: 'string expected' })
    } else if (options.edit != null && !isInteger(options.edit)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'edit', reason: 'integer expected' })
    } else if (options.edit == null && options.current != null && !isInteger(options.current)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'current', reason: 'integer expected' })
    }

    if (err) {
      return callback(err)
    }

    if (options.edit != null) {
      options.edit = parseInt(options.edit)
      options.current = null
    } else if (options.current != null) {
      options.current = parseInt(options.current)
    }

    tasks = [

      // load the spec (but only once)
      function(callback) {

        if (templateSpec) callback(null)
        else {
          Template.findOne({ org: principal.orgId, locale: { $in: [ null, [] ] }, type: type, name: name }).lean().exec(function(err, doc) {
            if (!err && (!doc || !pathTo(doc, 'spec.0'))) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'missing template spec' })
            }
            if (!err) templateSpec = doc.spec[0]
            callback(err)
          })
        }
      },

      // load the template and ensure version matches.
      function(callback) {
        const loc = Array.isArray(locale) ? { $in: locale } : locale
        Template.findOne({ org: principal.orgId, locale: loc, type: type, name: name }).lean().select(select).exec(function(err, doc) {

          if (!err && doc && options.createOnly) {
            err = Fault.create('cortex.conflict.exists')
          }

          // never allow saving version 0 of built-in templates.
          if (!err && options.edit === 0 && doc && doc.builtin && !options.updateZero) {
            err = Fault.create('cortex.accessDenied.unspecified', 'version 0')
          }

          // are we version matching?
          if (!err && options.current != null) {
            if (!doc) {
              err = Fault.create('cortex.notFound.unspecified', { msg: 'template version' })
            } else if (doc.version !== options.current) {
              err = Fault.create('cortex.conflict.staleDocument', { msg: 'template' })
            }
          }

          // are we attempting to edit a particular version? make sure it still exists.
          if (!err && options.edit != null && !options.updateZero) {
            if (!doc || toArray(doc.changes).map(function(v) { return v.version }).indexOf(options.edit) === -1) {
              err = Fault.create('cortex.notFound.unspecified', { msg: 'template version' })
            }
          }

          try {
            if (!(content = self.validateTemplateContent(templateSpec, content))) {
              err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'content' })
            }
          } catch (e) {
            err = e
          }

          callback(err, doc, content, err || hashContent(content))

        })
      },

      // edit/update the content.
      function(doc, content, sha1, callback) {

        if (!doc) {

          // this is a new template.
          self.precompile(principal, options.locale, type, name, content, function(err, compiled) {

            if (err) callback(err)
            else {
              // noinspection JSValidateTypes
              Template.create({
                org: principal.orgId,
                locale: options.locale,
                type: type,
                name: name,
                builtin: options.builtin,
                changes: [{
                  ordinal: new modules.db.mongoose.mongo.MaxKey(), // version 0 always lives at the end of the array. this is how sort and slice work on push while keeping version 0.
                  version: 0,
                  content: content,
                  sha1: sha1,
                  created: {
                    by: principal._id,
                    at: new Date()
                  }
                }],
                versions: [],
                current: {
                  version: 0,
                  content: content,
                  compiled: compiled
                },
                updated: {
                  by: principal._id,
                  at: new Date()
                },
                version: 0,
                sequence: 0

              }, function(err, template) {
                err = Fault.from(err)

                // another process has just inserted the document, either complain about versioning or retry as sequence error.
                if (err && err.errCode === 'cortex.conflict.duplicateKey') {
                  if (options.createOnly) {
                    err = Fault.create('cortex.conflict.exists')
                  } else {
                    err = Fault.create(options.version == null ? 'cortex.conflict.sequencing' : 'cortex.conflict.staleDocument')
                  }
                }
                callback(err, template, [])
              })
            }

          })

        } else {

          // find the index of the version we're updating (note version 0 is at the end of the array. so go 2 back.)
          let idx = options.edit == null ? Math.max(0, doc.changes.length - 2) : toArray(doc.changes).map(function(v) { return v.version }).indexOf(options.edit)

          if (doc.changes[idx].sha1 === sha1 && _.isEqual(doc.locale, options.locale)) {

            // no changes were detected.
            const template = new Template({}, select)
            template.init(doc)
            callback(null, template, [])

          } else {

            let dirty = [],
                update = {
                  $inc: {
                    sequence: 1
                  },
                  $set: {
                    locale: options.locale,
                    updated: {
                      by: principal._id,
                      at: new Date()
                    }
                  }
                },
                $set = update.$set,
                $push = null,
                find = { _id: doc._id, sequence: doc.sequence },
                render = false

            if (options.edit != null) {

              $set['changes.' + idx + '.content'] = content
              $set['changes.' + idx + '.sha1'] = sha1
              $set['changes.' + idx + '.updated'] = {
                by: principal._id,
                at: new Date()
              }

              dirty.push(options.edit)

              // if we are activating this content or it's already the active content, update the data.
              if (options.activate || doc.current.version === options.edit) {

                dirty.push(null)

                $set.current = {
                  version: options.edit,
                  content: content
                }
                render = true

              }

            } else {

              // increment the version. if we have specified a version for client-side version checking, we can rely on
              // the sequence number to ensure it's the same, as we have already checked the version earlier on. so, if
              // we error out due to a sequence error, we'll check the version again and all is good.
              update.$inc.version = 1

              // push the new content.
              $push = update.$push || (update.$push = {})
              $push.changes = {
                $each: [{
                  ordinal: doc.version + 1,
                  version: doc.version + 1,
                  created: {
                    by: principal._id,
                    at: new Date()
                  },
                  sha1: sha1,
                  content: content
                }],
                $sort: { ordinal: 1 },
                $slice: -(MAX_TEMPLATE_VERSIONS)
              }
              if (options.activate) {

                dirty.push(null)

                $set.current = {
                  version: doc.version + 1,
                  content: content
                }
                render = true
              }
            }

            async.waterfall([

              // pre-compile the template
              function(callback) {
                if (!render) callback(null)
                else {
                  self.precompile(principal, options.locale, type, name, content, function(err, compiled) {
                    if (!err) {
                      $set.current.compiled = compiled
                    }
                    callback(err)
                  })
                }
              },

              // save
              function(callback) {
                Template.findOneAndUpdate(find, update, { upsert: false, returnDocument: 'after' }, function(err, template) {
                  if (!err && !template) {
                    err = Fault.create('cortex.conflict.sequencing')
                  }
                  callback(err, template, dirty)
                })
              }

            ], callback)
          }
        }
      },

      // dirty templates that include this version.
      function(template, dirty, callback) {

        if (dirty.length > 0) {
          Template.collection.updateMany(
            { org: principal.orgId, locale: options.locale, type: type, 'current.compiled.includes': { $elemMatch: { name: name, versions: { $in: dirty } } } },
            { $set: { 'current.compiled.dirty': true } },
            function() {}
          )
        }

        callback(null, template)
      }

    ]

    // try a few times in case writes are coming in at the same time.
    function run(tasks, triesLeft) {
      async.waterfall(tasks, function(err, template) {
        triesLeft -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : triesLeft
        if (triesLeft) {
          setImmediate(run, tasks, triesLeft)
        } else {
          callback(err, template)
        }
      })
    }
    run(tasks, 10)

  },

  deleteTemplateType: function(principal, type, name, callback) {

    let err,
        Template = this,
        find = { org: principal.orgId, locale: { $in: [ null, [] ] }, type: type, name: name },
        select = { _id: 1, org: 1, sequence: 1, type: 1, name: 1, builtin: 1 }

    if (!ap.is(principal)) {
      err = Fault.create('cortex.invalidArgument.unspecified', 'principal')
    } else if (!_.isString(type)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'type', reason: 'string expected' })
    } else if (!_.isString(name)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'name', reason: 'string expected' })
    }

    if (err) {
      callback(err)
      return
    }

    Template.findOne(find).lean().select(select).exec(function(err, template) {

      if (!err) {
        if (!template) {
          err = Fault.create('cortex.notFound.unspecified')
        } else if (template.builtin) {
          err = Fault.create('cortex.accessDenied.unspecified', { reason: 'Builtin template cannot be deleted.' })
        }
      }
      if (err) {
        return callback(err)
      }

      // we can go ahead and remove this whole document.
      Template.fireHook('delete.before', null, { principal: principal, template: template }, (err) => {
        if (err) {
          return callback(err)
        }
        Template.deleteMany({ org: principal.orgId, type: type, name: name }, function(err) {
          Template.fireHook('delete.after', err || null, { principal: principal, template: template }, (err) => {
            callback(err, true)
          })
        })
      })

    })

  },

  deleteTemplate: function(principal, locale, type, name, version, callback) {

    let err,
        self = this,
        Template = this,
        tasks

    if (_.isFunction(version)) {
      callback = version
      version = null
    }
    callback = ensureCallback(callback)

    if (!ap.is(principal)) {
      err = Fault.create('cortex.invalidArgument.unspecified', 'principal')
    } else if (!modules.locale.isValid(locale) && isNotWildcardLocale(locale)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'locale', reason: `invalid locale: ${locale}` })
    } else if (!_.isString(type)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'type', reason: 'string expected' })
    } else if (!_.isString(name)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'name', reason: 'string expected' })
    } else if (version != null && !isInteger(version)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'version', reason: 'integer expected' })
    }

    if (err) {
      callback(err)
      return
    }

    if (version != null) {
      version = parseInt(version)
    }

    tasks = [

      // load the template to give error feedback
      function(callback) {

        const find = { org: principal.orgId, locale: locale, type: type, name: name },
              select = { _id: 1, version: 1, sequence: 1, 'current.version': 1, locale: 1, type: 1, name: 1, builtin: 1, changes: { $elemMatch: { version: version || 0 } } }

        Template.findOne(find).lean().select(select).exec(function(err, template) {
          if (!err) {
            if (!template) {
              err = Fault.create('cortex.notFound.unspecified', version == null ? 'localization' : 'version')
            } else if (version === 0) {
              err = Fault.create('cortex.accessDenied.unspecified', { reason: 'Cannot delete version 0 template content.' })
            } else if (!pathTo(template, 'changes.0')) {
              err = Fault.create('cortex.notFound.unspecified', 'version')
            }
          }
          callback(err, template)
        })

      },

      // we may have some manipulation to do. figure out what needs to change.
      function(template, callback) {

        if (version == null) {

          if (!template.builtin) {

            // we can go ahead and remove this whole document.
            Template.findOneAndRemove({ _id: template._id, sequence: template.sequence }, { select: { _id: 1 } }, function(err, removed) {
              if (!err && !removed) {
                err = Fault.create('cortex.conflict.sequencing')
              }
              callback(err)
            })

          } else {

            self.precompile(principal, locale, type, name, template.changes[0].content, function(err, compiled) {
              if (err) callback(err)
              else {

                // roll it all back to the original version. we have to keep version 0 (version 0 content is loaded in the find for version==null
                let update = {
                  $inc: {
                    sequence: 1
                  },
                  $set: {
                    version: 0,
                    updated: template.changes[0].updated || template.changes[0].created,
                    changes: [template.changes[0]],
                    current: {
                      content: template.changes[0].content,
                      version: 0,
                      compiled: compiled
                    }
                  }
                }

                Template.findOneAndUpdate({ _id: template._id, sequence: template.sequence }, update, function(err, updated) {
                  if (!err && !updated) {
                    err = Fault.create('cortex.conflict.sequencing')
                  }

                  // dirty all but version 0 template users.
                  if (!err) {
                    Template.collection.updateMany(
                      { org: principal.orgId, locale: locale, type: type, 'current.compiled.includes': { $elemMatch: { name: name, versions: { $ne: 0 } } } },
                      { $set: { 'current.compiled.dirty': true } },
                      function() {}
                    )
                  }

                  callback(err)
                })

              }
            })

          }

        } else {

          async.waterfall([

            // when removing the latest version or the active version, we need to get the latest
            // content in order to fix the document versions.
            function(callback) {

              if (version === template.current.version || template.version === version) {

                // if removing the latest version, get the one previous.
                // note: version 0 lives at the end of the array (ordinal sorting with MaxKey).
                // always get 2 items in case we've deleted them all, in which case only the last item and 0 will be in the list.

                // it's ok to go beyond the start of the array. mongodb tolerates this and will still give us version 0 if we go too far back.
                let select = { changes: { $slice: (template.version === version) ? [-3, 2] : [-2, 1] } }
                Template.findOne({ _id: template._id, sequence: template.sequence }).lean().select(select).exec(function(err, doc) {
                  let change = null
                  if (!err) {
                    if (!doc) {
                      err = Fault.create('cortex.conflict.sequencing')
                    } else if (!(change = pathTo(doc, 'changes.0'))) {
                      err = Fault.create('cortex.notFound.unspecified', 'content')
                    } else {
                      // we are removing the versy last item.
                      if (doc.changes.length === 2 && doc.changes[0].version === version && doc.changes[1].version === 0) {
                        change = doc.changes[1]
                      }
                    }
                  }
                  callback(err, change)
                })
              } else {
                callback(null, null)
              }
            },

            function(latest, callback) {
              if (latest) {
                self.precompile(principal, locale, type, name, latest.content, function(err, compiled) {
                  callback(err, latest, compiled)
                })
              } else {
                callback(err, null, null)
              }
            },

            function(latest, compiled, callback) {

              let dirty = [null],
                  update = {
                    $inc: {
                      sequence: 1
                    },
                    $pull: {
                      changes: {
                        version: version
                      }
                    }
                  },
                  $set

              // if we are removing the latest version, we need to rollback to the previous version
              if (template.version === version) {
                $set = update.$set || (update.$set = {})
                $set.version = latest.version
                $set.updated = latest.updated || latest.created
              }

              // if we are removing the currently active version, set the latest as the new content.
              if (version === template.current.version) {
                dirty.push(version)
                $set = update.$set || (update.$set = {})
                $set.current = {
                  content: latest.content,
                  version: latest.version,
                  compiled: compiled
                }
              }

              Template.findOneAndUpdate({ _id: template._id, sequence: template.sequence }, update, function(err, updated) {
                if (!err && !updated) {
                  err = Fault.create('cortex.conflict.sequencing')
                }

                // dirty version and current users.
                if (!err) {
                  Template.collection.updateMany(
                    { org: principal.orgId, locale: locale, type: type, 'current.compiled.includes': { $elemMatch: { name: name, versions: { $in: dirty } } } },
                    { $set: { 'current.compiled.dirty': true } },
                    function() {}
                  )
                }

                callback(err)
              })

            }

          ], callback)

        }

      }

    ]

    // try a few times in case writes are coming in at the same time.
    function run(tasks, triesLeft) {
      async.waterfall(tasks, function(err) {
        triesLeft -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : triesLeft
        if (triesLeft) {
          setImmediate(run, tasks, triesLeft)
        } else {
          callback(err)
        }
      })
    }
    run(tasks, 10)

  },

  //  doc: 'Delete a template localization. If version is omitted, the entire localization is deleted.\n' +
  // 'Notes: version 0 of built-in templates cannot be deleted.' +
  // 'If deleting the currently active version, active content will be set to the latest version of the template',

  /**
     *
     * @param principal
     * @param locale
     * @param type
     * @param name
     * @param options
     *  version: null. find a specific version. by default, loads the current version. (doesn't work well with fallback=true)
     *  latest: false. if true, loads the latest version. overrides 'version'.
     *  fallback: false. if true, loads the default en_US template content (doesn't work well with version!=null).
     *  spec: false. load the specs with the content.
     *  versions: false. also return all the versions.
     *  req: null,
     *  forRender: false. if true, returns only compiled content
     *
     * @param callback
     */
  loadTemplate: function(principal, locale, type, name, options, callback) {

    let err,
        self = this,
        Template = this,
        fallbackLocale = 'en_US',
        tasks

    locale = toArray(locale, true)

    if (_.isFunction(options)) {
      callback = options
      options = null
    }
    options = extend({
      version: null,
      fallback: false,
      latest: false,
      spec: false,
      versions: false,
      select: {},
      req: null,
      expand: true,
      forRender: false
    }, options)

    if (!ap.is(principal)) {
      err = Fault.create('cortex.invalidArgument.unspecified', 'principal')
    } else if (!modules.locale.isValid(locale) && isNotWildcardLocale(locale)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'locale', reason: `invalid locale: ${locale}` })
    } else if (!_.isString(type)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'type', reason: 'string expected' })
    } else if (!_.isString(name)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'name', reason: 'string expected' })
    } else if (options.version != null && !isInteger(options.version)) {
      err = Fault.create('cortex.invalidArgument.unspecified', { msg: 'version', reason: 'integer expected' })
    }

    if (err) {
      if (_.isFunction(callback)) {
        callback(err)
      }
      return
    }

    if (options.version != null) {
      options.version = parseInt(options.version)
    }

    tasks = [

      function(callback) {

        const single = (!options.spec && (!options.fallback || locale.length === 1)), // (!options.spec && (!options.fallback || locale[0] === fallbackLocale)),
              find = { org: principal.orgId, type: type, name: name },
              select = extend(options.select, { _id: 1, sequence: 1, version: 1, updated: 1, locale: 1, type: 1, name: 1, builtin: 1 }),
              locales = ['*', ...locale]

        if (!single) {
          if (options.spec) locales.push([], null)
        }
        if (options.fallback && locale.indexOf(fallbackLocale) < 0) {
          locales.push(fallbackLocale)
        }

        find.locale = { $in: locales }

        if (options.forRender) {

          select['current'] = 1
          options.versions = false

        } else {

          if (options.spec) select.spec = 1

          if (options.latest) {
            select.changes = { $slice: -2 } // remember, version 0 lives at the end of the array with ordinal MaxKey
            select['current.version'] = 1
          } else if (options.version != null) {
            select.changes = { $elemMatch: { version: options.version } }
            select['current.version'] = 1
          } else {
            select.current = 1
          }

        }

        Template.find(find).lean().select(select).exec(function(err, docs) {

          let template

          if (!err) {
            const hasStar = _.find(docs, doc => doc.locale?.indexOf('*') > -1)
            template = _.find(docs, (doc) => {
              const docLocales = toArray(doc.locale, true)
              return docLocales.some(loc => locale.indexOf(loc) > -1 && (hasStar ? loc.builtin === false : true))
            })
            if (!template) {
              template = _.find(docs, (doc) => {
                const docLocales = toArray(doc.locale, true)
                return docLocales.some(loc => locales.indexOf(loc) > -1)
              })
            }
            if (!template && options.fallback && locale.indexOf(fallbackLocale) < 0) {
              template = _.find(docs, function(doc) { return doc.locale.indexOf(fallbackLocale) > -1 })
            }
            if (!template) {
              err = Fault.create('cortex.notFound.unspecified', 'localization')
            }
          }
          if (!err && options.forRender) {

            // check if some of it's includes was compiled with an old version
            const includeOldDependecies = template.current.compiled && template.current.compiled.includes.filter(inc => !semver.satisfies(AsyncHandlebars.VERSION, inc.compiler_version) || !semver.satisfies(AsyncHandlebars.ASYNC_VERSION, inc.async_compiler_version)),
                  compilerVersion = String(pathTo(template, 'current.compiled.compiler_version')),
                  asyncCompilerVersion = String(pathTo(template, 'current.compiled.async_compiler_version'))
            let shouldCompile = includeOldDependecies.length > 0 || !pathTo(template, 'current.compiled') || pathTo(template, 'current.compiled.dirty')
            shouldCompile = shouldCompile || !semver.satisfies(AsyncHandlebars.VERSION, compilerVersion) || !semver.satisfies(AsyncHandlebars.ASYNC_VERSION, asyncCompilerVersion)
            // if the content is dirty. attempt to recompile. if that fails, update state.
            if (shouldCompile) {
              logger.silly('re-compiling dirty template')
              self.precompile(principal, locale, type, name, template.current.content, options, function(err, compiled) {
                if (err) {
                  logger.warn('on-the-fly template pre-compilation failed, using original')
                  callback(null, template.current.compiled)
                } else {
                  Template.findOneAndUpdate({ _id: template._id, sequence: template.sequence }, { $inc: { sequence: 1 }, $set: { 'current.compiled': compiled } }, function(err, doc) {
                    if (err) logger.error('on-the-fly template error', err.toJSON())
                    else if (!doc) logger.info('on-the-fly template re-cache attempt foiled! sequencing error')
                  })
                  callback(null, compiled)

                }
              })
            } else {
              callback(null, template.current.compiled)
            }
            return
          }
          if (!err) {
            if (options.spec) {
              template.spec = pathTo(_.find(docs, doc => doc.locale === null || (_.isArray(doc.locale) && _.isEmpty(doc.locale))), 'spec.0')
              if (!template.spec) {
                err = Fault.create('cortex.notFound.unspecified', 'spec')
              } else {

              }
            }
          }
          if (!err) {
            // let version
            if (options.latest || options.version != null) {
              // version = pathTo(template, 'changes.0.version')
              template.content = pathTo(template, 'changes.0.content')
            } else {
              template.content = pathTo(template, 'current.content')
              // version = pathTo(template, 'changes.0.version')
            }
            if (!template.content) {
              err = Fault.create('cortex.notFound.unspecified', 'version')
            } else {
              template.activeVersion = template.current.version
              template.latestVersion = template.version
              template.version = options.version != null ? options.version : (options.latest ? template.latestVersion : template.activeVersion)
              template.lastUpdated = template.updated
              delete template.current
              delete template.changes
              delete template.updated
            }
          }

          callback(err, template)

        })

      },

      function(template, callback) {

        let sequence = template.sequence
        delete template.sequence

        if (options.forRender || !options.versions) callback(null, template)
        else {

          Template.findOne({ _id: template._id, sequence: sequence }).lean().select({ 'changes.version': 1, 'changes.created': 1, 'changes.updated': 1 }).exec(function(err, doc) {
            if (!err && !doc) {
              err = Fault.create('cortex.conflict.sequencing')
            }
            if (!err) {
              template.versions = doc.changes.sort(function(a, b) { return a.version - b.version })
            }
            callback(err, template)
          })
        }

      },

      function(template, callback) {

        let Account = modules.db.models.account

        if (options.forRender || !options.expand) callback(err, template)
        else {
          Account.expandFields(principal, [{ name: 'by', expanded: 'by' }], template, { req: options.req, script: options.script, deep: true, expander: expandTemplateUpdaters }, function(err) {
            callback(err, template)
          })
        }
      }

    ]

    function run(tasks, triesLeft) {
      async.waterfall(tasks, function(err, template) {
        triesLeft -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : triesLeft
        if (triesLeft) {
          setImmediate(run, tasks, triesLeft)
        } else {
          callback(err, template)
        }
      })
    }
    run(tasks, 10)

  },

  /**
   * mimic loading the future template object. this is temporary in the sense that we'll be rolling
   *
   * template into a first class object, but the structure of a template should remain the same.
   * for now, we're only using this in exports and imports, so we can take liberties with what's included.
   *
   */
  aclCursor: function(principal, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const find = { org: principal.orgId, locale: { $in: [ null, [] ] } },
          type = options.type,
          name = options.name,
          specOnly = options.specOnly

    if (isSet(type)) {
      if ((!_.isString(type) || type.length === 0 || !type.match(TYPE_REGEX))) {
        callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid type name' }))
        return
      }
      find.type = type
    }

    if (isSet(name)) {
      if ((!_.isString(name) || name.length === 0 || !name.match(NAME_REGEX))) {
        callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid name' }))
        return
      }
      find.name = name
    }

    this.find(find).lean().exec((err, specs) => {

      if (err) {
        return callback(err)
      }

      callback(err, !err && new ArrayOutputCursor(
        specs,
        callback => callback(null, specs.length > 0),
        callback => {

          const doc = specs.shift(),
                { _id, org, type, name, spec, builtin } = doc,
                template = {
                  _id,
                  object: 'template',
                  type,
                  name,
                  builtin,
                  label: spec[0].nickname,
                  description: spec[0].summary,
                  variables: spec[0].variables,
                  content: spec[0].content
                }

          if (specOnly) {
            return callback(null, template)
          }

          this.find({ org, type, name, locale: { $nin: [ null, [] ] } }).lean().exec((err, docs) => {
            if (!err) {
              template.localizations = docs.map(localization => {
                const { locale, current } = localization
                return {
                  locale,
                  content: current.content.map(({ name, mime, includes, data }) => ({
                    name,
                    mime,
                    data,
                    includes
                  }))
                }
              })
            }
            callback(err, template)
          })
        }))
    })

  },

  listTemplates: function(principal, type, name, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const Template = this,
          Account = modules.db.models.account,
          find = { org: principal.orgId }

    if (type != null) {
      if ((!_.isString(type) || type.length === 0 || !type.match(TYPE_REGEX))) {
        callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid type name' }))
        return
      }
      find.type = type
    }

    if (name != null) {
      if ((!_.isString(name) || name.length === 0 || !name.match(NAME_REGEX))) {
        callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid name' }))
        return
      }
      find.name = name
    }

    Template.find(find).lean().select({ locale: 1, spec: 1, builtin: 1, type: 1, name: 1, updated: 1, 'current.version': 1, version: 1, 'changes.version': 1, 'changes.created': 1, 'changes.updated': 1 }).exec(function(err, docs) {
      if (err) callback(err)
      else {

        const templates = {}

        // pick out the specs.
        docs.forEach(function(doc) {
          if (doc.locale == null || isEmptyArray(doc.locale)) {

            let type = templates[doc.type] || (templates[doc.type] = { type: doc.type, templates: [] })
            type.templates.push({
              _id: doc._id,
              name: doc.name,
              spec: doc.spec[0],
              builtin: !!doc.builtin,
              localizations: []
            })
          }
        })

        // fill in each template. skip those with no matching spec.
        docs.forEach(function(doc) {
          const docLocales = toArray(doc.locale, true).filter(l => l)
          if (docLocales.length > 0) {
            let type, template
            const hasStar = docLocales.indexOf('*') > 0
            if ((type = templates[doc.type]) && (template = _.find(type.templates, function(template) { return template.name === doc.name }))) {
              template.localizations.push({
                locale: docLocales,
                activeVersion: doc.current.version,
                latestVersion: doc.changes[Math.max(0, doc.changes.length - 2)].version, // remember version 0 lives at the end of the changes array for sort n' slice.
                lastUpdated: doc.updated,
                versions: doc.changes.sort(function(a, b) { return a.version - b.version })
              })
            }
          }
        })

        // output as array
        let result = Object.keys(templates).map(function(type) {
          return templates[type]
        })

        Account.expandFields(principal, [{ name: 'by', expanded: 'by' }], result, { deep: true, expander: expandTemplateUpdaters }, function(err) {

          if (!err && type != null) {
            result = _.find(result, function(v) { return v.type === type })
            if (!result) {
              err = Fault.create('cortex.notFound.unspecified', name != null ? 'name' : 'type')
            } else if (name != null) {
              result = _.find(result.templates, function(v) { return v.name === name })
              if (!result) {
                err = Fault.create('cortex.notFound.unspecified', 'name')
              }
            }
          }

          callback(err, result)
        })

      }
    })

  },

  /**
     * @param principal the calling principal. used for all render context operations.
     * @param locale the desired locale. fallbacks may be used.
     * @param type the template type (email, sms, push, etc.)
     * @param name the template name (account-welcome, location-verification, etc.)
     * @param variables input variables according to the template spec.
     * @param callback --> err, {ctx: renderContext, output: [{name: entryName ("subject", "html", etc.), output: renderOutput, err: renderError}]}
     */
  renderTemplate: function(principal, locale, type, name, variables, callback) {

    let self = this
    const vars = _.clone(variables)

    this.loadTemplate(principal, locale, type, name, { forRender: true, fallback: true }, function(err, compiled) {
      if (err) callback(err)
      else {
        async.waterfall([
          function(callback) {
            self.prepareRenderContext(principal, locale, compiled.variables, vars, function(err, ctx) {
              callback(err, ctx)
            })
          },
          function(ctx, callback) {
            let partials = {}
            async.eachSeries(toArray(compiled.includes), function(include, callback) {
              try {
                toArray(include.versions).forEach(function(version) {
                  let name = include.name
                  if (version != null) name += (':' + version)
                  partials[name] = AsyncHandlebars.template(eval('(' + include.data + ')')) // eslint-disable-line no-eval
                })
              } catch (err) {}
              callback(null)
            })
            callback(null, { partials, ctx })
          }
        ], function(err, options) {
          const promises = []
          if (!err) {
            // just allow proto properties present in context.
            options.allowedProtoProperties = Object.keys(options.ctx).map(p => p).reduce((obj, prop) => {
              obj[prop] = true
              return obj
            }, {})
            // delete options.ctx.blocks
            options.data = {
              partials: options.partials,
              ctx: options.ctx,
              locale: locale
            }

            toArray(compiled.content).forEach(function(entry) {
              promises.push(new Promise((resolve) => {
                let result = {
                  name: entry.name
                }
                try {
                  const temp = AsyncHandlebars.template(eval('(' + entry.data + ')')) // eslint-disable-line no-eval
                  temp(options.ctx, options).then((response) => {
                    result.output = response
                    resolve(result)
                  })
                } catch (err) {
                  result.err = Fault.from(err).toJSON()
                  resolve(result)
                }
              }))
            })
          }
          Promise.all(promises).then((results) => {
            callback(null, { ctx: options.ctx, output: results })
          }).catch((e) => {
            callback(e, { ctx: options.ctx })
          })
        })
      }
    })
  }

}

function loadVariable(handler) {
  return function(principal, argument, options, callback) {

    if (_.isFunction(options)) {
      callback = options; options = {}
    } else {
      callback = ensureCallback(callback); options = options || {}
    }

    handler(principal, argument, options, callback)
  }
}

// expand updaters
function expandTemplateUpdaters(ids, callback) {

  let Account = modules.db.models.account

  Account.find({ _id: { $in: ids } }).lean().select({ _id: 1, name: 1 }).exec(function(err, list) {
    if (!err) {
      let matched = []
      list.forEach(function(item) {
        if (equalIds(item._id, acl.SystemAdmin)) {
          item.name = 'Medable'
        } else {
          item.name = ((pathTo(item, 'name.first') || '') + ' ' + (pathTo(item, 'name.last') || '')).trim()
        }
        matched.push(item._id.toString())
      })
      ids.forEach(function(id) {
        if (matched.indexOf(id.toString()) === -1) {
          list.push({
            _id: id,
            name: 'Unknown'
          })
        }
      })
    }
    callback(err, list)
  })
}

TemplateDefinition.indexes = [

  [{ org: 1, locale: 1, type: 1, name: 1 }, { unique: true, name: 'idxTemplateName' }]

]

module.exports = TemplateDefinition

TemplateDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `template.${doc.type}.${doc.name}`,
        def = _.pick(doc, [
          'object',
          'type',
          'name',
          'label',
          'description'
        ])

  if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  }

  def.partial = !!(pathTo(doc, 'content.length') === 1 && pathTo(doc, 'content.0.name') === 'partial')

  // def.variables = ... omit for now. may never be needed for limiting template content.
  def.localizations = doc.localizations.map(({ locale, content }) => ({
    locale,
    content: content.map(v => sortKeys(_.omit(v, '_id', 'mime'))).sort((a, b) => naturalCmp(a.name, b.name))
  }))

  for (let localizationIdx = 0; localizationIdx < def.localizations.length; localizationIdx += 1) {
    const localization = def.localizations[localizationIdx]
    for (let contentIdx = 0; contentIdx < localization.content.length; contentIdx += 1) {
      const content = localization.content[contentIdx]
      for (let includeIdx = 0; includeIdx < content.includes.length; includeIdx += 1) {
        const { name } = content.includes[includeIdx]
        await resourceStream.addMappedTemplate(ac, name, doc.type, joinPaths(resourcePath, 'localizations', localizationIdx, 'content', contentIdx), options)
      }
      delete content.includes
    }
  }

  return resourceStream.exportResource(sortKeys(def), resourcePath)

}

TemplateDefinition.prototype.import = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = joinPaths('template', getOption(doc, 'type', 'unknown'), getOption(doc, 'name', 'unknown'))

  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else {

    const templateModel = modules.db.models.template,
          isCustom = isCustomName(doc.name)

    // do not install or update builtin template specs
    if (isCustom) {

      const existingTemplate = await templateModel.findOne({
              org: ac.orgId,
              locale: { $in: [ null, [] ] },
              type: doc.type,
              name: doc.name
            }).lean().exec(),
            existingSpec = pathTo(existingTemplate, 'spec.0'),
            existingPartial = !!(pathTo(existingSpec, 'content.length') === 1 && pathTo(existingSpec, 'content.0.name') === 'partial')

      if (existingTemplate) {
        if (doc.partial !== existingPartial) {
          throw Fault.create('cortex.invalidArgument.unspecified', {
            reason: 'Incompatible template change detected. Both templates must be either partial or not.',
            path: resourcePath
          })
        }
      }

      await promised(
        templateModel,
        'installTemplateSpec',
        ac.org,
        doc.type,
        doc.name,
        {
          nickname: doc.label,
          summary: doc.description,
          content: modules.templates.getTemplateSpec(doc.type, doc.partial),
          variables: []
        },
        {
          builtin: false,
          overwrite: true
        }
      )

    }

    for (let localization of toArray(doc.localizations)) {

      const locale = toArray(pathTo(localization, 'locale'), true),
            content = toArray(pathTo(localization, 'content'))

      for (const entry of content) {
        const data = rString(pathTo(entry, 'data'), ''),
              includes = templateModel.findContentIncludes({ data })

        for (const include of includes) {
          await resourceStream.importMappedTemplate(ac, include.name, doc.type, `${resourcePath}.localizations.content.includes`)
        }
      }

      let template = await promised(templateModel, 'updateTemplate', ac.principal, locale, doc.type, doc.name, content, {
        activate: true,
        builtin: !isCustom
      })
      void template
    }

    // no one cares about the _id of the spec.
    return { _id: createId(), name: doc.name, type: doc.type }

  }

}
