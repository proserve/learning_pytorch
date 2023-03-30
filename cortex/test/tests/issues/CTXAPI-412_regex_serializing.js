'use strict'

require('should')

const sas = require('../../lib/sandboxed-standalone'),
      { promised, serializeObject } = require('../../../lib/utils'),
      path = require('path')

describe('Issues - CTXAPI-412 serialize regex to and from sandbox', function() {

  it('should serialize regex to and from sandbox correctly', async() => {

    // sandbox script
    const main = function() {

            require('should')

            var api = require('api'),
                deserialize = require('util.json').deserialize,
                regexes = deserialize(api.regexes),
                echoed = api.echo(regexes),
                i,
                regex,
                echo

            for (i = 0; i < regexes.length; i += 1) {
              regex = regexes[i]
              echo = echoed[i]
              echo.should.be.instanceOf(RegExp)
              echo.toString().should.equal(regex.toString())
            }

            return { regexes, echoed }

          },

          // regex to marshall and compare
          regexes = [
            /^simple/,
            /^$/,
            /^simple/ig,
            /simple$/,
            new RegExp('//'),
            /^[a-z0-9-_]{1,40}(#[a-z0-9-_]{1,40})?$/,
            /^[a-z0-9-_]{1,40}$/,
            /^\/([^\/?]*)/, // eslint-disable-line no-useless-escape
            /^[a-z0-9-_]{1,40}(\[])?(#)?(#[a-z0-9-_]{1,40})?$/i,
            /^{{2}([a-zA-Z0-9-_.]{1,100})}{2}$/,
            /^(?:[\w!#$%&'*+\-\/=?^`{|}~]+\.)*[\w!#$%&'*+\-\/=?^`{|}~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/, // eslint-disable-line no-useless-escape
            /^(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/ // eslint-disable-line no-useless-escape
          ],

          // host api
          echo = function(regexes, callback) {
            let err
            try {
              for (const regex of regexes) {
                regex.should.be.instanceOf(RegExp)
                regex.toString().should.equal(regex.toString())
              }
            } catch (e) {
              err = e
            }
            callback(err, regexes)

          },

          run = sas(
            main
            ,
            {
              jspath: path.resolve(path.join(__dirname, '../../../lib/modules/sandbox/scripts/build/modules')),
              transpile: false,
              api: {
                api: {
                  echo,
                  regexes: serializeObject(regexes)
                }
              }
            }
          ),

          results = await promised(null, run)

    for (let i = 0; i < regexes.length; i += 1) {

      const regex = regexes[i]

      results.regexes[i].should.be.instanceOf(RegExp)
      results.echoed[i].should.be.instanceOf(RegExp)
      results.regexes[i].toString().should.equal(regex.toString())
      results.echoed[i].toString().should.equal(regex.toString())

    }

  })

})
