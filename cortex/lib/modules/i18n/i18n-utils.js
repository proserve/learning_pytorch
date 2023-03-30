const { isObject } = require('underscore'),
      { path: pathTo } = require('../../utils')

function mergeDeep(target, source) {
  let output = Object.assign({}, target)
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = mergeDeep(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }
  return output
}

function flattenPaths(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : ''
    if (typeof obj[k] === 'object') Object.assign(acc, flattenPaths(obj[k], pre + k))
    else acc[pre + k] = obj[k]
    return acc
  }, {})
}

function extractVars(entry) {
  const re = /{{[{]?(.*?)[}]?}}/g,
        tags = [],
        root = {},
        stack = []
  let matches,
      context = root
  while ((matches = re.exec(entry))) {
    if (matches) {
      tags.push(matches[1])
    }
  }
  // eslint-disable-next-line one-var
  const setVar = (variable, val) => {
    // Dot Notation Breakdown
    if (variable.match(/\.*\./) && !variable.match(/\s/)) {
      context[variable.trim()] = ''
    } else {
      context[variable.trim()] = val
    }
  }
  for (let tag of tags) {
    if (tag.startsWith('! ') || tag === 'else') {
      continue
    }
    if ('#^'.includes(tag[0]) && !tag.includes(' ')) {
      setVar(tag.substr(1), true)
      stack.push(context)
      continue
    }
    if (tag.startsWith('#if')) {
      const vars = tag.split(' ').slice(1)
      for (const v of vars) {
        setVar(v, true)
      }
      stack.push(context)
      continue
    }

    if (tag.startsWith('#with ')) {
      const v = tag.split(' ')[1]
      let newContext = {}
      pathTo(context, v, newContext)
      stack.push(context)
      context = newContext
      continue
    }

    if (tag.startsWith('#unless ')) {
      const v = tag.split(' ')[1]
      setVar(v, true)
      stack.push(context)
      continue
    }

    if (tag.startsWith('#each ')) {
      const v = tag.split(' ')[1],
            newContext = {}
      pathTo(context, v, [newContext])
      stack.push(context)
      context = newContext
      continue
    }
    if (tag.startsWith('/')) {
      context = stack.pop() || {}
      continue
    }
    setVar(tag, '')
  }

  return Object.keys(root)
}

function formatLocaleToCortex(locale) {
  return locale.replace('-', '_')
}
function formatCortexToLocale(locale) {
  return locale.replace('_', '-')
}

module.exports = {
  mergeDeep,
  flattenPaths,
  extractVars,
  formatLocaleToCortex,
  formatCortexToLocale
}
