'use strict'

const uuid = require('uuid'),
      PropertyDefinition = require('../property-definition'),
      Fault = require('cortex-service/lib/fault'),
      byteToHex = [],
      { path: pathTo, array: toArray, isSet, naturalCmp, isUuidString } = require('../../../../utils')

for (let i = 0; i < 256; i++) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1)
}

class UuidDefinition extends PropertyDefinition {

  constructor(options) {

    super(options)

    this.uuidVersion = options.uuidVersion
    this.autoGenerate = options.autoGenerate

    this.set.push(value => {
      if (this.array) {
        return toArray(value).map(value => this.castToBuffer(value))
      }
      return this.castToBuffer(value)
    })

    if (this.autoGenerate && [-1, 1, 4].includes(this.uuidVersion)) {
      this.default = () => {
        if (this.uuidVersion === 1) {
          return this.castToBuffer(uuid.v1())
        }
        return this.castToBuffer(uuid.v4())
      }
    }

    this.readerSearchOverride = true
    this.reader = function(ac, node, selection) {
      return node._recurseRead(pathTo(this, (selection && selection.pathOverride) || node.docpath))
    }

    this.validators.push({
      name: 'adhoc',
      definition: {
        validator: function(ac, node, value) {
          return value === null || value === undefined || node.validateBuffer(ac, value, node.uuidVersion)
        }
      }
    })

  }

  static get typeName() {
    return 'UUID'

  }

  static get mongooseType() {
    return 'Buffer'
  }

  _recurseRead(value) {
    if (Array.isArray(value)) {
      return value.map(value => this._recurseRead(value))
    }
    const buffer = (Buffer.isBuffer(value) && value) || (value && Buffer.isBuffer(value.buffer) && value.buffer)
    if (!buffer) {
      return value || undefined
    }
    return this.stringify(buffer)
  }

  getTypeName() {
    return UuidDefinition.typeName
  }

  stringify(buf, offset = 0) {

    let i = offset
    return byteToHex[buf[i++]] + byteToHex[buf[i++]] +
        byteToHex[buf[i++]] + byteToHex[buf[i++]] + '-' +
        byteToHex[buf[i++]] + byteToHex[buf[i++]] + '-' +
        byteToHex[buf[i++]] + byteToHex[buf[i++]] + '-' +
        byteToHex[buf[i++]] + byteToHex[buf[i++]] + '-' +
        byteToHex[buf[i++]] + byteToHex[buf[i++]] +
        byteToHex[buf[i++]] + byteToHex[buf[i++]] +
        byteToHex[buf[i++]] + byteToHex[buf[i++]]
  }

  castForQuery(ac, value) {
    value = this.castToBuffer(value)
    if (value === null || value === undefined) {
      return null
    }
    this.validateBuffer(ac, value)
    return value
  }

  equals(a, b) {
    try {
      return isSet(a) && isSet(b) && this.castToBuffer(a).equals(this.castToBuffer(b))
    } catch (err) {
      void err
    }
    return false
  }

  compare(a, b) {
    try {
      return naturalCmp(
        this.stringify(this.castToBuffer(a)),
        this.stringify(this.castToBuffer(b))
      )
    } catch (err) {
      void err
    }
    return 0
  }

  static getProperties() {
    return [
      {
        label: 'Version',
        name: 'uuidVersion',
        type: 'Number',
        writable: true,
        default: 4,
        dependencies: ['.autoGenerate'],
        writer: function(ac, node, value) {
          this.markModified('autoGenerate')
          return value
        },
        validators: [{
          name: 'options',
          definition: {
            values: [{
              label: 'Any',
              value: -1
            }, {
              label: 'v1',
              value: 1
            }, {
              label: 'v3/v5',
              value: 3
            }, {
              label: 'v4',
              value: 4
            }]
          }
        }]
      },
      {
        label: 'Auto Generate',
        name: 'autoGenerate',
        type: 'Boolean',
        writable: true,
        default: false,
        writer: function(ac, node, value) {
          this.markModified('uuidVersion')
          return value
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'Auto-generated uuids can only be version 1 or 4.',
            validator: function(ac, node, value) {
              return value !== true || [-1, 1, 4].includes(this.uuidVersion)
            }
          }
        }, {
          name: 'adhoc',
          definition: {
            message: 'Auto-generated uuids are not available for arrays',
            validator: function(ac, node, value) {
              return value !== true || this.array !== true
            }
          }
        }]
      }
    ]
  }

  validateBuffer(ac, buffer, version = -1) {

    if (Buffer.isBuffer(buffer)) {

      const str = this.stringify(buffer).toLowerCase()

      if (isUuidString(str)) {

        const ver = str.charAt(14) | 0

        if (version === -1 || version === ver) {

          if (ver === 1 || ver === 2) {
            return true
          } else if (ver === 3 || ver === 4 || ver === 5) {
            if (['8', '9', 'a', 'b'].includes(str.charAt(19))) {
              return true
            }
          }
        }
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: `Invalid uuid version ${ver}.` })
      }
      throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: `Invalid uuid format.` })
    }
    throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: `Invalid uuid.` })
  }

  /**
   * cast into a 16-byte buffer
   *
   * @param value
   * @returns {*}
   */
  castToBuffer(value) {

    if (value === null || value === undefined) {
      return value
    }

    let casted = null,
        buffer = (Buffer.isBuffer(value) && value) || (value && Buffer.isBuffer(value.buffer) && value.buffer)

    if (buffer) {

      if (buffer.length === 16) {
        casted = buffer
      } else if (buffer.length <= 38) {

        // might have casted string straight into buffer
        value = buffer.toString('utf8')
      }
    }

    if (!casted && typeof value === 'string') {

      // accept curly braces
      if (value.length === 38 && value[0] === '{' && value[37] === '}') {
        value = value.slice(1, 37)
      }

      value = value.replace(/-/g, '')
      if (value.length === 32) {
        casted = Buffer.from(value, 'hex')
      }

    }

    if (casted === null || casted.length !== 16) {
      throw Fault.create('cortex.invalidArgument.castError', { reason: 'Could not cast value to UUID.', path: this.fullpath })
    }

    return casted

  }

}

module.exports = UuidDefinition
