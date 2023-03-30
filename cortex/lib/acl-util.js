const { EntryTypes, AccessLevels } = require('./acl'),
      ap = require('./access-principal'),
      { array: toArray, rString, isSet, rInt, isInt } = require('./utils'),
      { capitalize } = require('inflection'),
      { isString, pick } = require('underscore')

/**
 * parseAcl
 *
 * @returns {Promise<void>}
 */
async function parseAcl(ac, values, options) {
  values = toArray(values, isSet(values))

  const out = [],
        entries = JSON.parse(JSON.stringify(values)),
        { principalResolver = principalToId, expressionResolver = resolveExpression, forReference = false, forCreate = false } = options || {}

  for (const doc of entries) {

    let tmp, def = {}
    if (isString(doc)) { // shorthand!
      const split = doc.split(','),
            parts = (split[0] || '').split('.'),
            paths = split.slice(1),
            [type, targetOrExpression, allow] = parts,
            fieldName = type === 'expression' ? 'expression' : 'target'

      tmp = { type, [fieldName]: targetOrExpression, allow, paths }

    } else {
      tmp = pick(doc, ['type', 'target', 'allow', 'expression', 'paths'])
    }

    if (isSet(tmp.expression)) {
      def.expression = await expressionResolver(ac, def.type, tmp.expression)
      tmp.target = def.target = null
      if (!isSet(tmp.type)) {
        tmp.type = 'expression'
      }
      if (!isSet(tmp.allow)) {
        def.allow = null
      }
    }

    def.type = rInt(tmp.type, EntryTypes[capitalize(rString(tmp.type, ''))])

    if (isSet(tmp.target)) {

      const isPrincipal = isInt(tmp.type) ? [EntryTypes.Account, EntryTypes.Role].includes(tmp.type) : ['account', 'role', 'serviceAccount'].includes(tmp.type)
      if (isPrincipal) {
        def.target = await principalResolver(ac, tmp.type, tmp.target)
      } else {
        const accessLevel = rInt(tmp.target, AccessLevels[capitalize(rString(tmp.target, ''))]),
              field = isSet(tmp.allow) ? 'target' : 'allow'
        if (isSet(accessLevel)) {
          def[field] = accessLevel
        } else {
          def[field] = await principalResolver(ac, 'role', tmp.target)
        }
      }
    }

    if (!forCreate) {
      if (isSet(tmp.allow)) {
        const accessLevel = rInt(tmp.allow, AccessLevels[capitalize(rString(tmp.allow, ''))])
        if (isSet(accessLevel)) {
          def.allow = accessLevel
        } else {
          def.allow = await principalResolver(ac, 'role', tmp.allow)
        }
      }
    }

    if (forReference) {
      def.paths = toArray(tmp.paths)
    }

    out.push(def)

  }

  return out

}

async function principalToId(ac, type, uniqueKey) {

  let principal
  try {
    principal = await ap.create(ac.org, uniqueKey)
  } catch (err) {}
  return principal && principal._id

}

async function resolveExpression(ac, type, expression) {

  return expression

}

module.exports = {

  parseAcl,
  principalToId

}
