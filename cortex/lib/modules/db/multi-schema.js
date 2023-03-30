'use strict'

const mongoose = require('mongoose')

class DocumentSet extends mongoose.Schema.Types.DocumentArray {

  constructor(key, options) {

    let schema

    const {
            propertyNode
          } = options,
          {
            discriminatorKey,
            documents
          } = propertyNode,
          discriminatorValues = Object.keys(documents),
          first = discriminatorValues[0],
          { _id, [discriminatorKey]: discriminatorField } = documents[first]?.properties || {},
          schemaObject = {}

    if (_id) {
      schemaObject._id = _id.generateMongooseProperty(true)
    }

    if (discriminatorField) {
      schemaObject[discriminatorKey] = discriminatorField.generateMongooseProperty(true)
      schemaObject[discriminatorKey].acValidation.push(
        ['stringEnum', { values: discriminatorValues }]
      )
    }

    schema = new mongoose.Schema(
      schemaObject,
      {
        _id: false,
        discriminatorKey
      }
    )

    super(
      key,
      schema,
      options
    )

    for (const [discriminatorValue, document] of Object.entries(documents)) {
      const child = document.generateMongooseSchema({ inSet: true, exclude: ['_id', discriminatorKey] })
      this.discriminator(discriminatorValue, child)
    }

  }

}

mongoose.Schema.Types.Set = DocumentSet
