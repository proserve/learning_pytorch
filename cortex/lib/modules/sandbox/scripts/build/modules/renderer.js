'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();

var _db = require('db.cursor');
var _db2 = require('db.operation');
var _objects = require('objects');var _objects2 = _interopRequireDefault(_objects);
var _underscore = require('underscore');var _underscore2 = _interopRequireDefault(_underscore);
var _util = require('util.object');
var _stream = require('stream');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var _module$exports =

module.exports,_start = _module$exports.start,_status = _module$exports.status,_cancel = _module$exports.cancel,_getVersion = _module$exports.getVersion,
pApiKey = Symbol('apiKey'),
pInputs = Symbol('inputs'),
pTemplates = Symbol('templates'),
pOutputs = Symbol('outputs'),
pTargets = Symbol('targets'),
pCallback = Symbol('callback'),
pOptions = Symbol('options');var

Job = function () {

  function Job(apiKey) {var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};_classCallCheck(this, Job);
    this[pApiKey] = apiKey;
    this[pInputs] = {};
    this[pTemplates] = [];
    this[pOutputs] = [];
    this[pTargets] = [];
    this[pCallback] = null;
    this[pOptions] = options;
  }_createClass(Job, [{ key: 'addCursor', value: function addCursor(

    name, obj) {
      if (!(obj instanceof _db.QueryCursor) && !(obj instanceof _db.AggregationCursor) && !(obj instanceof _db2.BulkOperation)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'the argument is not a cursor nor a bulk operation' });
      }
      var options = obj.getOptions();

      if (obj instanceof _db2.BulkOperation) {
        var readOps = options.ops.filter(function (op) {return ['cursor', 'readOne'].indexOf(op.operation) > -1;});
        if (readOps.length !== options.ops.length) {
          throw Fault.create('cortex.invalidArgument.readOperationsOnly', { reason: 'only read bulk operations are allowed' });
        }
      }

      this[pInputs][name] = {
        type: obj instanceof _db2.BulkOperation ? 'bulk' : 'cursor',
        name: obj instanceof _db2.BulkOperation ? 'bulk' : options.object,
        options: options };

      return this;
    } }, { key: 'addApiRequest', value: function addApiRequest(

    name, path, environment, credentials) {var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};var requestOptions = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
      if (!environment) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing environment object.' });
      }
      if (!credentials) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials object.' });
      }
      if (['token', 'signature'].indexOf(credentials.type.toLowerCase()) < 0) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only Token and Signature types are allowed' });
      }
      this[pInputs][name] = {
        type: 'apiRequest',
        path: path,
        environment: environment,
        credentials: _extends({ apiKey: this[pApiKey] }, credentials),
        options: _extends(_extends({ method: 'GET' }, options), { requestOptions: requestOptions }) };

      return this;
    } }, { key: 'addObject', value: function addObject(

    name, obj) {
      if (!Array.isArray(obj) && !(0, _util.isPlainObject)(obj)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'the argument is not an object' });
      }
      this[pInputs][name] = obj;
      return this;
    } }, { key: 'addTemplate', value: function addTemplate(

    name, content) {var isPartial = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;var locale = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'en_US';
      var exists = _underscore2.default.find(this[pTemplates], function (t) {return t.name === name;});
      if (!exists) {
        this[pTemplates].push({
          name: name,
          locale: locale,
          content: content,
          isPartial: isPartial });

      }
      return this;
    } }, { key: 'addOutput', value: function addOutput(

    name, type, templates, options) {
      var output = {
        name: name,
        type: type,
        templates: !_underscore2.default.isArray(templates) ? [templates] : templates,
        options: options };

      this._validateOutput(output);
      this[pOutputs].push(output);
      return this;
    } }, { key: 'addSftpTarget', value: function addSftpTarget(

    outputs, credentials, options) {
      var target = {
        type: 'sftp',
        credentials: credentials,
        outputs: outputs,
        options: _underscore2.default.pick(options, 'compress') };

      this._validateSftpTarget(target);
      this[pTargets].push(target);
      return this;
    } }, { key: 'addFtpTarget', value: function addFtpTarget(

    outputs, credentials, options) {
      var target = {
        type: 'ftp',
        credentials: credentials,
        outputs: outputs,
        options: _underscore2.default.pick(options, 'compress') };

      this._validateFtpTarget(target);
      this[pTargets].push(target);
      return this;
    } }, { key: 'addFileTarget', value: function addFileTarget(

    path, _ref, options) {var facets = _ref.facets;
      var objectName = path.split('/')[0],
      pathObject = path.split('/').slice(1).join('/'),
      file = _objects2.default.read(objectName, pathObject),
      target = {
        type: 'file',
        file: file,
        facets: facets,
        options: _underscore2.default.pick(options, 'compress') };

      this._validateFileTarget(target);
      this[pTargets].push(target);
      return this;
    } }, { key: 'addCallback', value: function addCallback(

    path, environment, credentials) {var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};var requestOptions = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
      if (!environment) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing environment object.' });
      }
      if (!credentials) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials object.' });
      }
      if (['token', 'signature'].indexOf(credentials.type.toLowerCase()) < 0) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only Token and Signature types are allowed' });
      }
      this[pCallback] = {
        type: 'apiRequest',
        path: path,
        environment: environment,
        credentials: _extends({ apiKey: this[pApiKey] }, credentials),
        options: _extends(_extends({ method: 'POST' }, options), { requestOptions: requestOptions }) };

      return this;
    } }, { key: '_validateOutput', value: function _validateOutput(

    output) {
      if (!output.name) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing output name.' });
      }
      if (!output.type) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing output type.' });
      }
      if (!output.templates || output.templates.length === 0) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing template/s to use for output.' });
      }
      if (output.options) {
        this._validateOutputOptions(output);
      }
    } }, { key: '_validateOutputOptions', value: function _validateOutputOptions(

    output) {
      if (
      _typeof(output.options) !== 'object' ||
      Array.isArray(output.options) ||
      output.options === null ||
      Object.keys(output.options).length < 1)
      {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Output options must be a non-empty object.' });
      }

      switch (output.type) {
        case 'csv':
          this._validateCsvOptions(output.options);
          break;
        case 'html':
          this._validateHtmlOptions(output.options);
          break;
        case 'pdf':
          this._validatePdfOptions(output.options);
          break;
        default:
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Output type: ' + output.type + ', does not support options.' });}

    } }, { key: '_validateCsvOptions', value: function _validateCsvOptions(

    options) {
      var validColumnDelimiters = /^[,;|]$/,
      validLineDelimiters = ['\n', '\r', '\n\r'];

      Object.keys(options).forEach(function (option) {
        var argument = options[option];

        switch (option) {
          case 'columnDelimiter':
            if (!validColumnDelimiters.test(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Column delimiter must be , ; or |' });
            }
            break;
          case 'lineDelimiter':
            if (!validLineDelimiters.includes(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Line delimiter must be \n, \r, or \n\r' });
            }
            break;
          default:
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: option + ' is not a valid option for csv output.' });}

      });
    } }, { key: '_validateHtmlOptions', value: function _validateHtmlOptions(

    options) {
      Object.keys(options).forEach(function (option) {
        switch (option) {
          default:
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: option + ' is not a valid option for html output.' });}

      });
    } }, { key: '_validatePdfOptions', value: function _validatePdfOptions(

    options) {
      var validOptions = {
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
        'disallow-modify': false },

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
      'demy-quarto', 'demy-octavo'],

      validProfiles = [
      'PDF/A-1a', 'PDF/A-1b', 'PDF/A-3a', 'PDF/A-3b', 'PDF/UA-1', 'PDF/X-1a:2001',
      'PDF/X-1a:2003', 'PDF/X-3:2002', 'PDF/X-3:2003', 'PDF/X-4'];


      Object.keys(options).forEach(function (option) {
        var argument = options[option],
        argumentType = validOptions[option];

        if (argumentType === undefined) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The Prince XML option ' + option + ' is not supported.' });
        } else if (argumentType === false && argument !== true) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The Prince XML option ' + option + ' requires the boolean argument true.' });
        }

        switch (argumentType) {
          case 'input-format':
            if (!['auto', 'xml', 'html'].includes(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for ' + option + ' option.' });
            }
            break;
          case 'media':
            if (!['all', 'print', 'screen', 'speech'].includes(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for media option.' });
            }
            break;
          case 'page-size':
            if (!validSizes.includes(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for page-size option.' });
            }
            break;
          case 'page-margin':
            if (!/^\d{1,2}mm$/.test(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for page-margin option.' });
            }
            break;
          case 'pdf-profile':
            if (!validProfiles.includes(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: argument + ' is not a valid argument for pdf-profile option.' });
            }
            break;
          case 'key-bits':
            if (typeof argument !== 'number' || argument !== 40 && argument !== 128) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Argument for key-bits option must be the number 40 or 128.' });
            }
            break;
          case 'string':
            if (!/^[\w.-]+$/.test(argument)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid string argument ' + argument + ' (dashes, underscores, periods and alpha numeric characters only)' });
            } else if (argument.length >= 30) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Argument for ' + option + ' must be less than 30 characters long.' });
            }
            break;
          default:
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The Prince XML option ' + option + ' is not supported (missing validation).' });}

      });
    } }, { key: '_validateFileTarget', value: function _validateFileTarget(

    target) {
      if (!target.type) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing target type.' });
      }
      if (!target.file) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing file object target.' });
      }
      if (!target.facets || Object.keys(target.facets).length < 1) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing facets object' });
      }
      if (!target.file.uploads || target.file.uploads.length < 1) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The file object is not available to upload, it contains a resource already' });
      }
    } }, { key: '_validateSftpTarget', value: function _validateSftpTarget(

    target) {
      if (!target.type) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing target type.' });
      }
      if (!target.outputs || Object.keys(target.outputs).length < 1) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing outputs for sftp target.' });
      }
      if (!target.credentials) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials for sftp target.' });
      }var

      compress = target.options.compress;
      if (compress) {
        if (!compress.filename || typeof compress.filename !== 'string') {
          throw Fault.create('cortex.invalidArgument.compressFilenameMissing', { reason: 'filename is not present or is not string type in compress.filename' });
        }
        if (!compress.outputs || compress.outputs.length < 1) {
          throw Fault.create('cortex.invalidArgument.compressOutputsMissing', { reason: 'outputs is not present in compress.outputs' });
        }
      }
    } }, { key: '_validateFtpTarget', value: function _validateFtpTarget(

    target) {
      if (!target.type) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing target type.' });
      }
      if (!target.outputs || Object.keys(target.outputs).length < 1) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing outputs for ftp target.' });
      }
      if (!target.credentials) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing credentials for ftp target.' });
      }var

      compress = target.options.compress;
      if (compress) {
        if (!compress.filename || typeof compress.filename !== 'string') {
          throw Fault.create('cortex.invalidArgument.compressFilenameMissing', { reason: 'filename is not present or is not string type in compress.filename' });
        }
        if (!compress.outputs || compress.outputs.length < 1) {
          throw Fault.create('cortex.invalidArgument.compressOutputsMissing', { reason: 'outputs is not present in compress.outputs' });
        }
      }
    } }, { key: '_validateOutputTemplates', value: function _validateOutputTemplates()

    {
      var currentTemplateNames = _underscore2.default.map(this[pTemplates], 'name');
      _underscore2.default.forEach(this[pOutputs], function (out) {
        if (_underscore2.default.difference(out.templates, currentTemplateNames).length) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Some of the templates specified are not found, available templates: [' + currentTemplateNames + ']' });
        }
      });
    } }, { key: '_validateTargetOutputs', value: function _validateTargetOutputs()

    {var _this = this;
      _underscore2.default.forEach(this[pTargets], function (target) {

        var currentOutputs = _this[pOutputs],
        compress = target.options.compress;

        if (target.type === 'file') {(function () {
            var facets = target.facets,
            keys = Object.keys(facets);
            if (keys.length < 1) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Missing output facets' });
            }var _loop = function _loop(
            fk) {
              var exists = _underscore2.default.find(currentOutputs, function (co) {return co.name === facets[fk];});
              if (!exists) {
                throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid output name: ' + facets[fk] });
              }};var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {for (var _iterator = keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var fk = _step.value;_loop(fk);
              }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}})();
        }
        if (target.type === 'sftp' || target.type === 'ftp') {
          var out = Object.keys(target.outputs);var _loop2 = function _loop2(
          o) {
            var exists = _underscore2.default.find(currentOutputs, function (co) {return co.name === o;});
            if (!exists) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid output name: ' + o });
            }};var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {for (var _iterator2 = out[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var o = _step2.value;_loop2(o);
            }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2.return) {_iterator2.return();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
        }
        if (compress) {
          compress.outputs.forEach(function (out) {
            if (_underscore2.default.map(currentOutputs, function (c) {return c.name;}).indexOf(out) < 0) {
              throw Fault.create('cortex.invalidArgument.compressOutputsMissing', { reason: '[' + out + '] defined in compress.outputs is not valid' });
            }
          });
        }
      });
    } }, { key: '_prepareData', value: function _prepareData()

    {

      this._validateOutputTemplates();
      this._validateTargetOutputs();

      return {
        apiKey: this[pApiKey],
        inputs: this[pInputs],
        templates: this[pTemplates],
        targets: this[pTargets],
        outputs: this[pOutputs],
        callback: this[pCallback],
        options: this[pOptions] };

    } }, { key: 'start', value: function start()

    {
      var result = _start(this._prepareData());
      if (this[pTargets].length < 1) {
        return new _stream.OpaqueStream(result);
      }
      return result;
    } }, { key: 'getVersion', value: function getVersion()

    {
      return _getVersion();
    } }, { key: 'status', value: function status(

    jobId) {
      if (typeof jobId !== 'string') {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Job Id must be an string' });
      }
      return _status(jobId);
    } }, { key: 'cancel', value: function cancel(

    jobId) {
      if (typeof jobId !== 'string') {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Job Id must be an string' });
      }
      return _cancel(jobId);
    } }]);return Job;}();



module.exports = {
  Job: Job };