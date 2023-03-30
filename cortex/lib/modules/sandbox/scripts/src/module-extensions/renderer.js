/* global Fault */

import { QueryCursor, AggregationCursor } from 'db.cursor'
import { BulkOperation } from 'db.operation'
import objects from 'objects'
import _ from 'underscore'
import { isPlainObject } from 'util.object'
import { OpaqueStream } from 'stream'

const { start, status, cancel, getVersion } = module.exports,
      pApiKey = Symbol('apiKey'),
      pInputs = Symbol('inputs'),
      pTemplates = Symbol('templates'),
      pOutputs = Symbol('outputs'),
      pTargets = Symbol('targets'),
      pCallback = Symbol('callback'),
      pOptions = Symbol('options')

class Job {

  constructor(apiKey, options = {}) {
    this[pApiKey] = apiKey
    this[pInputs] = {}
    this[pTemplates] = []
    this[pOutputs] = []
    this[pTargets] = []
    this[pCallback] = null
    this[pOptions] = options
  }

  addCursor(name, obj) {
    if (!(obj instanceof QueryCursor) && !(obj instanceof AggregationCursor) && !(obj instanceof BulkOperation)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'the argument is not a cursor nor a bulk operation' })
    }
    const options = obj.getOptions()

    if (obj instanceof BulkOperation) {
      const readOps = options.ops.filter((op) => ['cursor', 'readOne'].indexOf(op.operation) > -1)
      if (readOps.length !== options.ops.length) {
        throw Fault.create('cortex.invalidArgument.readOperationsOnly', { reason: 'only read bulk operations are allowed' })
      }
    }

    this[pInputs][name] = {
      type: (obj instanceof BulkOperation) ? 'bulk' : 'cursor',
      name: (obj instanceof BulkOperation) ? 'bulk' : options.object,
      options
    }
    return this
  }

  addApiRequest(name, path, environment, credentials, options = {}, requestOptions = {}) {
    if (!environment) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing environment object.' })
    }
    if (!credentials) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials object.' })
    }
    if (['token', 'signature'].indexOf(credentials.type.toLowerCase()) < 0) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only Token and Signature types are allowed' })
    }
    this[pInputs][name] = {
      type: 'apiRequest',
      path,
      environment,
      credentials: { apiKey: this[pApiKey], ...credentials },
      options: { ...({ method: 'GET', ...options }), requestOptions }
    }
    return this
  }

  addObject(name, obj) {
    if (!Array.isArray(obj) && !isPlainObject(obj)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'the argument is not an object' })
    }
    this[pInputs][name] = obj
    return this
  }

  addTemplate(name, content, isPartial = false, locale = 'en_US') {
    const exists = _.find(this[pTemplates], (t) => t.name === name)
    if (!exists) {
      this[pTemplates].push({
        name,
        locale,
        content,
        isPartial
      })
    }
    return this
  }

  addOutput(name, type, templates, options) {
    const output = {
      name,
      type,
      templates: !_.isArray(templates) ? [templates] : templates,
      options
    }
    this._validateOutput(output)
    this[pOutputs].push(output)
    return this
  }

  addSftpTarget(outputs, credentials, options) {
    const target = {
      type: 'sftp',
      credentials,
      outputs,
      options: _.pick(options, 'compress')
    }
    this._validateSftpTarget(target)
    this[pTargets].push(target)
    return this
  }

  addFtpTarget(outputs, credentials, options) {
    const target = {
      type: 'ftp',
      credentials,
      outputs,
      options: _.pick(options, 'compress')
    }
    this._validateFtpTarget(target)
    this[pTargets].push(target)
    return this
  }

  addFileTarget(path, { facets }, options) {
    const objectName = path.split('/')[0],
          pathObject = path.split('/').slice(1).join('/'),
          file = objects.read(objectName, pathObject),
          target = {
            type: 'file',
            file,
            facets,
            options: _.pick(options, 'compress')
          }
    this._validateFileTarget(target)
    this[pTargets].push(target)
    return this
  }

  addCallback(path, environment, credentials, options = {}, requestOptions = {}) {
    if (!environment) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing environment object.' })
    }
    if (!credentials) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials object.' })
    }
    if (['token', 'signature'].indexOf(credentials.type.toLowerCase()) < 0) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only Token and Signature types are allowed' })
    }
    this[pCallback] = {
      type: 'apiRequest',
      path,
      environment,
      credentials: { apiKey: this[pApiKey], ...credentials },
      options: { ...({ method: 'POST', ...options }), requestOptions }
    }
    return this
  }

  _validateOutput(output) {
    if (!output.name) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing output name.' })
    }
    if (!output.type) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing output type.' })
    }
    if (!output.templates || output.templates.length === 0) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing template/s to use for output.' })
    }
    if (output.options) {
      this._validateOutputOptions(output)
    }
  }

  _validateOutputOptions(output) {
    if (
      typeof output.options !== 'object' ||
      Array.isArray(output.options) ||
      output.options === null ||
      Object.keys(output.options).length < 1
    ) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Output options must be a non-empty object.' })
    }

    switch (output.type) {
      case 'csv':
        this._validateCsvOptions(output.options)
        break
      case 'html':
        this._validateHtmlOptions(output.options)
        break
      case 'pdf':
        this._validatePdfOptions(output.options)
        break
      default:
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Output type: ' + output.type + ', does not support options.' })
    }
  }

  _validateCsvOptions(options) {
    const validColumnDelimiters = /^[,;|]$/,
          validLineDelimiters = ['\n', '\r', '\n\r']

    Object.keys(options).forEach(function(option) {
      let argument = options[option]

      switch (option) {
        case 'columnDelimiter':
          if (!validColumnDelimiters.test(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Column delimiter must be , ; or |' })
          }
          break
        case 'lineDelimiter':
          if (!validLineDelimiters.includes(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Line delimiter must be \n, \r, or \n\r' })
          }
          break
        default:
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: option + ' is not a valid option for csv output.' })
      }
    })
  }

  _validateHtmlOptions(options) {
    Object.keys(options).forEach(function(option) {
      switch (option) {
        default:
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: option + ' is not a valid option for html output.' })
      }
    })
  }

  _validatePdfOptions(options) {
    const validOptions = {
            input: 'input-format',
            media: 'media',
            'page-size': 'page-size',
            'page-margin': 'page-margin',
            'pdf-profile': 'pdf-profile',
            'pdf-lang': 'string',
            'tagged-pdf': false,
            'no-artificial-fonts': false,
            'no-embed-fonts': false,
            'no-subset-fonts': false,
            'force-identity-encoding': false,
            'no-compress': false,
            'no-object-streams': false,
            'pdf-title': 'string',
            'pdf-subject': 'string',
            'pdf-author': 'string',
            'pdf-keywords': 'string',
            'pdf-creator': 'string',
            encrypt: false,
            'key-bits': 'key-bits',
            'user-password': 'string',
            'owner-password': 'string',
            'disallow-print': false,
            'disallow-copy': false,
            'disallow-annotate': false,
            'disallow-modify': false
          },
          validSizes = [
            'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
            'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10',
            'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10',
            'id-1', 'id-2', 'id-3', 'US-Legal', 'US-Executive', 'US-Letter',
            'US-Ledger', 'US-Tabloid', 'US-Statement', 'US-Folio',
            'US-Government', 'ansi-a', 'ansi-b', 'ansi-c', 'ansi-d', 'ansi-e',
            'arch-a', 'arch-b', 'arch-c', 'arch-d', 'arch-e1', 'arch-e',
            'imperial-folio', 'imperial-quarto', 'imperial-octavo',
            'royal-folio', 'royal-quarto', 'royal-octavo', 'crown-folio',
            'crown-quarto', 'crown-octavo', 'foolscap-folio',
            'foolscap-quarto', 'foolscap-octavo', 'medium-quarto',
            'demy-quarto', 'demy-octavo'
          ],
          validProfiles = [
            'PDF/A-1a', 'PDF/A-1b', 'PDF/A-3a', 'PDF/A-3b', 'PDF/UA-1', 'PDF/X-1a:2001',
            'PDF/X-1a:2003', 'PDF/X-3:2002', 'PDF/X-3:2003', 'PDF/X-4'
          ]

    Object.keys(options).forEach(function(option) {
      let argument = options[option],
          argumentType = validOptions[option]

      if (argumentType === undefined) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The Prince XML option ' + option + ' is not supported.' })
      } else if (argumentType === false && argument !== true) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The Prince XML option ' + option + ' requires the boolean argument true.' })
      }

      switch (argumentType) {
        case 'input-format':
          if (!['auto', 'xml', 'html'].includes(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for ' + option + ' option.' })
          }
          break
        case 'media':
          if (!['all', 'print', 'screen', 'speech'].includes(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for media option.' })
          }
          break
        case 'page-size':
          if (!validSizes.includes(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for page-size option.' })
          }
          break
        case 'page-margin':
          if (!/^\d{1,2}mm$/.test(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for page-margin option.' })
          }
          break
        case 'pdf-profile':
          if (!validProfiles.includes(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for pdf-profile option.' })
          }
          break
        case 'key-bits':
          if (typeof argument !== 'number' || (argument !== 40 && argument !== 128)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Argument for key-bits option must be the number 40 or 128.' })
          }
          break
        case 'string':
          if (!/^[\w.-]+$/.test(argument)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid string argument ' + argument + ' (dashes, underscores, periods and alpha numeric characters only)' })
          } else if (argument.length >= 30) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Argument for ' + option + ' must be less than 30 characters long.' })
          }
          break
        default:
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The Prince XML option ' + option + ' is not supported (missing validation).' })
      }
    })
  }

  _validateFileTarget(target) {
    if (!target.type) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing target type.' })
    }
    if (!target.file) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing file object target.' })
    }
    if (!target.facets || Object.keys(target.facets).length < 1) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing facets object' })
    }
    if (!target.file.uploads || target.file.uploads.length < 1) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The file object is not available to upload, it contains a resource already' })
    }
  }

  _validateSftpTarget(target) {
    if (!target.type) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing target type.' })
    }
    if (!target.outputs || Object.keys(target.outputs).length < 1) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing outputs for sftp target.' })
    }
    if (!target.credentials) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials for sftp target.' })
    }

    const { compress } = target.options
    if (compress) {
      if (!compress.filename || typeof compress.filename !== 'string') {
        throw Fault.create('cortex.invalidArgument.compressFilenameMissing', { reason: 'filename is not present or is not string type in compress.filename' })
      }
      if (!compress.outputs || compress.outputs.length < 1) {
        throw Fault.create('cortex.invalidArgument.compressOutputsMissing', { reason: 'outputs is not present in compress.outputs' })
      }
    }
  }

  _validateFtpTarget(target) {
    if (!target.type) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing target type.' })
    }
    if (!target.outputs || Object.keys(target.outputs).length < 1) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing outputs for ftp target.' })
    }
    if (!target.credentials) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials for ftp target.' })
    }

    const { compress } = target.options
    if (compress) {
      if (!compress.filename || typeof compress.filename !== 'string') {
        throw Fault.create('cortex.invalidArgument.compressFilenameMissing', { reason: 'filename is not present or is not string type in compress.filename' })
      }
      if (!compress.outputs || compress.outputs.length < 1) {
        throw Fault.create('cortex.invalidArgument.compressOutputsMissing', { reason: 'outputs is not present in compress.outputs' })
      }
    }
  }

  _validateOutputTemplates() {
    const currentTemplateNames = _.map(this[pTemplates], 'name')
    _.forEach(this[pOutputs], (out) => {
      if (_.difference(out.templates, currentTemplateNames).length) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Some of the templates specified are not found, available templates: [${currentTemplateNames}]` })
      }
    })
  }

  _validateTargetOutputs() {
    _.forEach(this[pTargets], (target) => {

      const currentOutputs = this[pOutputs],
            { compress } = target.options

      if (target.type === 'file') {
        const { facets } = target,
              keys = Object.keys(facets)
        if (keys.length < 1) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing output facets' })
        }
        for (const fk of keys) {
          const exists = _.find(currentOutputs, (co) => co.name === facets[fk])
          if (!exists) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Invalid output name: ${facets[fk]}` })
          }
        }
      }
      if (target.type === 'sftp' || target.type === 'ftp') {
        const out = Object.keys(target.outputs)
        for (const o of out) {
          const exists = _.find(currentOutputs, (co) => co.name === o)
          if (!exists) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Invalid output name: ${o}` })
          }
        }
      }
      if (compress) {
        compress.outputs.forEach((out) => {
          if (_.map(currentOutputs, c => c.name).indexOf(out) < 0) {
            throw Fault.create('cortex.invalidArgument.compressOutputsMissing', { reason: `[${out}] defined in compress.outputs is not valid` })
          }
        })
      }
    })
  }

  _prepareData() {

    this._validateOutputTemplates()
    this._validateTargetOutputs()

    return {
      apiKey: this[pApiKey],
      inputs: this[pInputs],
      templates: this[pTemplates],
      targets: this[pTargets],
      outputs: this[pOutputs],
      callback: this[pCallback],
      options: this[pOptions]
    }
  }

  start() {
    const result = start(this._prepareData())
    if (this[pTargets].length < 1) {
      return new OpaqueStream(result)
    }
    return result
  }

  getVersion() {
    return getVersion()
  }

  status(jobId) {
    if (typeof jobId !== 'string') {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Job Id must be an string' })
    }
    return status(jobId)
  }

  cancel(jobId) {
    if (typeof jobId !== 'string') {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Job Id must be an string' })
    }
    return cancel(jobId)
  }

}

module.exports = {
  Job
}
