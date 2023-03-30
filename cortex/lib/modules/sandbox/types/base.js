'use strict'

function BaseScriptType() {

}

BaseScriptType.prototype.parseResources = async function(ac, doc) {

  void ac
  void doc
  return []

}

BaseScriptType.prototype.buildRuntime = async function(ac, runtime, scripts) {

}

BaseScriptType.prototype.getTypeProperties = function() {
  throw new Error('cortex.error.pureVirtual')
}

module.exports = BaseScriptType
