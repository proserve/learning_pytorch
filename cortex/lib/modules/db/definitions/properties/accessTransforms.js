const acl = require('../../../../acl'),
      { pick } = require('underscore'),
      modules = require('../../../../modules'),
      { resolveOptionsCallback, array: toArray, idArrayUnion } = require('../../../../utils'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault')

/**
 *
 * @param ac
 * @param parentDocument
 * @param options
 *  forWrite = false
 *  inheritInstanceRoles = false
 *  inheritPropertyAccess = false
 * @param callback
 * @returns {*}
 * @private
 */
function transformAccessContext(ac, parentDocument, options, callback) {

  [options, callback] = resolveOptionsCallback(options, callback, false, false)

  const promise = new Promise((resolve, reject) => {

    // for now, only principal transforms are supported so we only need to clone the principal.
    const transformedAc = ac.copy(ac.subject, null, true, true, this.getRuntimeOption('inheritInstanceRoles', parentDocument)),
          transformedPrincipal = transformedAc.principal = ac.principal.clone(),
          transforms = toArray(this.accessTransforms)

    if (this.getRuntimeOption('inheritPropertyAccess', parentDocument)) {
      transformedAc.grant = Math.max(ac.grant, this.getRuntimeAccess(ac, options.forWrite))
    }

    if (transforms.length === 0) {
      return resolve(transformedAc)
    }

    async.eachSeries(
      transforms,
      async(transform) => {

        switch (transform.name) {

          case 'expression': {

            const ec = modules.expressions.createContext(
                    transformedAc,
                    { $object: transform.expression },
                    {
                      $$ROOT: transformedAc.subject
                    }
                  ),
                  result = pick(await ec.evaluate() || {}, 'grant', 'roles', 'skipAcl', 'bypassCreateAcl', 'scope')

            transformedPrincipal.merge(transformedAc, result || {})

            break
          }

          case 'direct': {

            const node = this.parent.findNode(transform.property),
                  fqpp = node && node.fqpp

            // find the first document.
            // again, only input._id supported for now, so we know to compare ObjectIds.

            if (fqpp) {
              this.parent.walkDocument(parentDocument, (doc, node) => {
                if (node.fqpp === fqpp) {
                  let matchedData = doc[transform.property]
                  if (matchedData) {
                    if (matchedData.toObject) {
                      matchedData = matchedData.toObject()
                    }
                    if (node.getTypeName() === 'String') {
                      matchedData = toArray(matchedData, true)
                        .reduce((arr, str) => {
                          const role = ac.org.roles.find(v => v.code === str)
                          if (role) {
                            arr.push(role._id)
                          }
                          return arr
                        }, [])
                    }
                    transformedPrincipal.roles = idArrayUnion(transformedPrincipal.roles, toArray(matchedData, true))
                  }
                  return -1
                }
              })
            }

            break
          }

          default:

        }

      },
      err => {
        err ? reject(err) : resolve(transformedAc)
      }
    )
  })

  if (callback) {
    promise
      .then(v => callback(null, v))
      .catch(e => callback(e))
  }

  return promise
}

module.exports = {
  transformAccessContext,
  definition: () => ({
    label: 'Access Transformations',
    name: 'accessTransforms',
    type: 'Set',
    writable: true,
    mergeOverwrite: true,
    documents: [{
      label: 'Expression',
      name: 'expression',
      type: 'Document',
      writable: true,
      properties: [{
        label: 'Expression',
        name: 'expression',
        type: 'Expression',
        operator: 'object',
        writable: true,
        validators: [{
          name: 'required'
        }]
      }]
    }, {
      // a property matcher in the current document
      label: 'Direct',
      name: 'direct',
      type: 'Document',
      writable: true,
      properties: [{
        // the principal property to modify.
        label: 'Target',
        name: 'target',
        type: 'String',
        writable: true,
        validators: [{
          name: 'required'
        }, {
          name: 'stringEnum',
          definition: {
            values: ['roles']
          }
        }]
      }, {
        // the action to take.
        label: 'Action',
        name: 'action',
        type: 'String',
        writable: true,
        validators: [{
          name: 'required'
        }, {
          name: 'stringEnum',
          definition: {
            values: ['union']
          }
        }]
      }, {
        // the source of the data in the local document.
        label: 'Property',
        name: 'property',
        type: 'String',
        writable: true,
        dependencies: ['name'],
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: {
            min: 1,
            max: 256
          }
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {

              const property = this.parent().parentArray().find(v => v.name === value),
                    fqpp = property && modules.db.definitions.getInstancePath(property, node, true, true)

              if (!property) {
                return callback(Fault.create('cortex.notFound.property', { path: fqpp }))
              } else if (!['String', 'ObjectId'].includes(property.type)) {
                return callback(Fault.create('cortex.notFound.property', { reason: 'Access transform source property must be an ObjectId or String' }))
              }
              modules.db.definitions.generateCustomModel(modules.db.getRootDocument(this).toObject(), (err, Local) => {
                if (!err) {
                  let propertyNode = Local.schema.node.findNodeByFqpp(fqpp)
                  if (propertyNode) {
                    if (!propertyNode.readable || propertyNode.readAccess > acl.AccessLevels.Script) {
                      propertyNode = null
                    }
                  }
                  if (!propertyNode) {
                    err = Fault.create('cortex.notFound.property', { path: fqpp })
                  } else if (!['String', 'ObjectId'].includes(propertyNode.getTypeName())) {
                    err = Fault.create('cortex.notFound.property', { reason: 'Access transform source property must be an ObjectId or String' })
                  }
                }
                callback(err)
              })

            }
          }
        }]
      }]

    }]
  })
}
