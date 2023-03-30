'use strict'

const utils = require('../../../../utils'),
      clone = require('clone'),
      _ = require('underscore'),
      { createHash } = require('crypto'),
      hasOwnProperty = Object.prototype.hasOwnProperty

class SelectionTree {

  constructor(options) {

    this._options = null

    options = options || {}

    this.parent = options.parent
    this.parentDocument = options.parentDocument
    this.root = options.parent ? options.parent.root : this
    this.nodeFilter = options.nodeFilter
    this.ignoreMissing = options.ignoreMissing
    this.ignoreMixedPaths = options.ignoreMixedPaths

    this.selections = {}
    this.keys = []

    if (options.projection) {

      this.projection = options.projection // <-- new support for projections as selections instead
      this.expand = true

    } else {

      this.path = this.root === this ? '' : options.path || ''
      this.singlePath = options.singlePath
      this.expand = false

      // @todo explicit expansion?

      // include default paths if no paths are passed in.
      let paths = _.isString(options.paths) ? [options.paths] : utils.array(options.paths),
          include = _.isString(options.include) ? [options.include] : utils.array(options.include),
          expand = _.isString(options.expand) ? [options.expand] : utils.array(options.expand),
          passive = paths.length === 0,
          i

      for (i = 0; i < paths.length; i++) {
        if (paths[i]) {
          this.addPath(paths[i])
        }
      }

      this.passive = passive // include all non-optional, readable paths.

      for (i = 0; i < include.length; i++) {
        if (include[i]) {
          this.addInclude(include[i])
        }
      }

      for (i = 0; i < expand.length; i++) {
        if (expand[i]) {
          this.addExpansion(expand[i])
        }
      }
    }

  }

  merge(other) {

    if (!other.passive) this.passive = false
    if (other.expand) this.expand = true
    this.nodeFilter = other.nodeFilter
    this.ignoreMissing = !!other.ignoreMissing
    this.ignoreMixedPaths = !!other.ignoreMixedPaths

    for (let key in other.selections) {
      if (other.selections.hasOwnProperty(key)) {
        if (!this.selections[key]) {
          this.selections[key] = new SelectionTree({ parent: this, path: key, nodeFilter: this.nodeFilter, ignoreMissing: this.ignoreMissing, ignoreMixedPaths: this.ignoreMixedPaths })
          this.selections[key].merge(other.selections[key])
          this.keys.push(key)
        }
      }
    }

    return this

  }

  get signature() {

    const start = utils.profile.start(),

          signature = createHash('md5').update(utils.serializeObject([
            this.projection,
            this.keys,
            this.path,
            this.pathOverride,
            this.fullPath,
            Object.entries(this.selections).map(([key, value]) => {
              return [
                key,
                value.signature
              ]
            })
          ], true)).digest('hex')

    utils.profile.end(start, 'SelectionTree.signature')

    return signature

  }

  get fullPath() {

    if (this.$__fullPath === undefined) {
      let s = this, p = []
      while (s) {
        if (s.path) p.unshift(s.path)
        s = s.parent
      }
      this.$__fullPath = p.join('.')
    }
    return this.$__fullPath
  }

  get singlePath() {

    let s = this
    while (s) {
      if (s.$__singlePath) return s.$__singlePath
      s = s.parent
    }
    return null
  }

  set singlePath(path) {
    this.$__singlePath = utils.normalizeObjectPath(path, false, false, true)
    this.$__propPath = null
  }

  get propPath() {
    let s = this
    while (s) {
      if (s.$__propPath) return s.$__propPath
      if (s.$__singlePath) {
        if (s.$__propPath === undefined) {
          s.$__propPath = utils.normalizeObjectPath(s.$__singlePath, true, true, true)
        }
        return s.$__propPath || null
      }
      s = s.parent
    }
    return null
  }

  getTreatAsIndividualProperty() {
    return !!this._individual
  };

  setTreatAsIndividualProperty(path) {

    if (!path) {
      this._individual = true
      return
    }

    let parts = utils.pathParts(utils.normalizeObjectPath(path, true, true, true)),
        prefix = parts[0],
        suffix = parts[1],
        selections = this.selections,
        selection = selections[prefix]

    if (!selection) {
      selection = this.addInclude(path)
    }

    if (selection) {
      if (suffix) {
        selection.setTreatAsIndividualProperty(suffix)
      } else {
        selection._individual = true
      }
    }

  };

  _add(path, func, normalize, checkPassive) {

    let parts = utils.pathParts(utils.normalizeObjectPath(path, normalize, normalize, true)),
        prefix = parts[0],
        suffix = parts[1],
        selections = this.selections,
        selection = selections[prefix],
        key,
        isInteger = utils.isInteger(prefix),
        isIdFormat = utils.isIdFormat(prefix)

    // guard against setting function and proto values.
    if (selections[prefix] && !hasOwnProperty.call(selections, prefix)) {
      return null
    }

    if (!selection) {
      selection = selections[prefix] = new SelectionTree({ parent: this, path: prefix, nodeFilter: this.nodeFilter, ignoreMissing: this.ignoreMissing, ignoreMixedPaths: this.ignoreMixedPaths })
      if (!(selection instanceof SelectionTree)) {
        return null // some attempt to overwrite was foiled.
      }
      this.keys.push(prefix)
    }

    if (suffix) {
      this.expand = true
      selection[func](suffix)
    }

    if (!isInteger && !isIdFormat) {

      // we only want to be non-passive when adding a universal path (for document array reads). an indexed/id-based document array read implies the explicit inclusion of those paths.
      if (checkPassive) {
        this.passive = false
      }

      // there may be indexed/id based selections. if so, add all non-indexed/non-id selections to those so the document readers know what to fetch from each document.
      for (key in selections) {
        if (selections.hasOwnProperty(key)) {
          if (utils.isInteger(key) || utils.isIdFormat(key)) {
            selections[key][func](path)
          }
        }
      }
    }

    return selection

  }

  addPath(path) {
    this.passive = false
    return this._add(path, 'addPath', false, true)
  }

  addInclude(path) {
    return this._add(path, 'addInclude', true, false)
  }

  addExpansion(path) {
    let selection = this._add(path, 'addExpansion', true, false)
    selection.expand = true
    return selection
  }

  /**
     * stops if anything but true is returned from inside fn. returns null on success.
     */
  eachSelection(node, parentDocument, fn, options) {

    let i,
        result = true,
        path,
        paths = this.keys,
        skipIndexes = !!utils.option(options, 'skipIndexes'),
        skipIds = !!utils.option(options, 'skipIds')

    // start with explicit selections first, then passive selections.
    for (i = 0; i < paths.length; i++) {
      path = paths[i]

      if (skipIndexes && utils.isInteger(path)) {
        continue
      } else if (skipIds && utils.isIdFormat(path)) {
        continue
      } else if (this.nodeFilter && !this.nodeFilter(node)) {
        continue
      }
      this.selections[path].parentDocument = parentDocument
      if ((result = fn(path, this.selections[path])) !== true) {
        return result
      }
    }

    if (this.passive) {
      result = true
      node.eachChild(n => {
        if (result === true) {
          let path = n.path
          if (!n.optional && n.readable && !~paths.indexOf(path) && (!this.nodeFilter || this.nodeFilter(n))) {
            result = fn(path, new SelectionTree({ parent: this, parentDocument: parentDocument, path: path, nodeFilter: this.nodeFilter, ignoreMissing: this.ignoreMissing, ignoreMixedPaths: this.ignoreMixedPaths }))
          }
        }
      })
    }
    return result === true ? null : result
  }

  hasSubSelections(indexes, ids) {

    let key, selections = this.selections
    for (key in selections) {
      if (selections.hasOwnProperty(key)) {
        if (indexes && utils.isInteger(key)) {
          if (selections[key].hasSubSelections(false, false)) {
            return true
          }
        } else if (ids && utils.isIdFormat(key)) {
          if (selections[key].hasSubSelections(false, false)) {
            return true
          }
        } else {
          return true
        }
      }
    }
    return false
  }

  findSelection(path) {

    let suffix, idx = path.indexOf('.'), selection
    if (~idx) {
      suffix = path.substr(idx + 1)
      path = path.substr(0, idx)
    }

    selection = this.selections[path]
    if (selection && suffix) {
      return selection.findSelection(suffix)
    }
    return selection
  }

  cloneWithSelections(options) {

    const tree = new SelectionTree(utils.extend({
      parent: this.parent,
      singlePath: this.singlePath,
      nodeFilter: this.nodeFilter,
      ignoreMissing: this.ignoreMissing,
      ignoreMixedPaths: this.ignoreMixedPaths,
      expand: utils.array(options.paths, !!options.paths).filter(path => utils.path(this.selections[path], 'expand')) // support for legacy expanding.
    }, options))
    tree._options = clone(this._options)

    // this is a huge hack. SelectionTree has got to go with 320 @todo @hack @broken
    Object.keys(tree.selections).forEach(key => {
      const thisSel = this.selections[key]
      if (thisSel) {
        const treeSel = tree.selections[key]
        treeSel._individual = thisSel._individual
      }
    })

    return tree
  }

  getSubSelections(indexes, ids) {

    let subs = [], key, selections = this.selections
    for (key in selections) {
      if (selections.hasOwnProperty(key)) {
        if (indexes && utils.isInteger(key)) {
          subs = subs.concat(selections[key].getSubSelections(false, false))
        } else if (ids && utils.isIdFormat(key)) {
          subs = subs.concat(selections[key].getSubSelections(false, false))
        } else {
          subs.push(key)
        }
      }
    }
    return _.uniq(subs)
  }

  setOption(option, value) {
    if (!this._options) {
      this._options = {}
    }
    if (value === undefined) {
      delete this._options[option]
    } else {
      this._options[option] = value
    }
  }

  getOption(option, defaultValue) {

    if (this._options && this._options[option] !== undefined) {
      let value = this._options[option]
      return value === undefined ? defaultValue : value
    } else if (this.root === this) {
      return undefined
    } else {
      return this.parent.getOption(option, defaultValue)
    }

  }

}

module.exports = SelectionTree
