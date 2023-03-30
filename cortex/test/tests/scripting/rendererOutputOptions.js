'use strict'

const wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {
    const { Job } = require('renderer'),
          job = new Job('')

    // #1
    ;(function emptyObject() {
      try {
        job.addOutput('my_html', 'html', ['my_template'], {})
      } catch (err) {
        if (err.reason === 'Output options must be a non-empty object.') {
          return
        }
        throw err
      }
      throw new Error('empty object should cause an error.')
    }())

    // #2
    ;(function string() {
      try {
        job.addOutput('my_html', 'html', ['my_template'], 'options')
      } catch (err) {
        if (err.reason === 'Output options must be a non-empty object.') {
          return
        }
        throw err
      }
      throw new Error('string should cause an error.')
    }())

    // #3
    ;(function array() {
      try {
        job.addOutput('my_html', 'html', ['my_template'], ['options'])
      } catch (err) {
        if (err.reason === 'Output options must be a non-empty object.') {
          return
        }
        throw err
      }
      throw new Error('array should cause an error.')
    }())

    // #4
    ;(function invalidType() {
      try {
        job.addOutput('my_txt', 'txt', ['my_template'], { 'option': 'option' })
      } catch (err) {
        if (err.reason === 'Output type: txt, does not support options.') {
          return
        }
        throw err
      }
      throw new Error('invalid output type should cause an error.')
    }())

    // #5
    ;(function invalidCsvOutputOption() {
      try {
        job.addOutput('my_csv', 'csv', ['my_template'], { 'lineDelimiter': '|' })
      } catch (err) {
        if (err.reason === 'lineDelimiter is not a valid option for csv output.') {
          return
        }
        throw err
      }
      throw new Error('invalid csv output option should cause an error.')
    }())

    // #6
    ;(function invalidCsvColumnDelimiter() {
      try {
        job.addOutput('my_csv', 'csv', ['my_template'], { 'columnDelimiter': '<' })
      } catch (err) {
        if (err.reason === 'Column delimiter must be , ; or |') {
          return
        }
        throw err
      }
      throw new Error('invalid csv column delimiter should cause error.')
    }())

    // #7
    ;(function invalidHtmlOutputOption() {
      try {
        job.addOutput('my_html', 'html', ['my_template'], { 'badOption': 'arg' })
      } catch (err) {
        if (err.reason === 'badOption is not a valid option for html output.') {
          return
        }
        throw err
      }
      throw new Error('invalid html output option should cause error.')
    }())

    // #8
    ;(function invalidPdfOption() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'script': 'true' })
      } catch (err) {
        if (err.reason === 'The Prince XML option script is not supported.') {
          return
        }
        throw err
      }
      throw new Error('invalid pdf output option should cause error.')
    }())

    // #9
    ;(function pdfOutputOptionRequiresTrue() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'tagged-pdf': 'should be true' })
      } catch (err) {
        if (err.reason === 'The Prince XML option tagged-pdf requires the boolean argument true.') {
          return
        }
        throw err
      }
      throw new Error('no argument pdf output option without true should cause error.')
    }())

    // #10
    ;(function invalidPdfInputFormatArgument() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'input': 'txt' })
      } catch (err) {
        if (err.reason === 'txt is not a valid argument for input option.') {
          return
        }
        throw err
      }
      throw new Error('invalid argument for pdf input option should cause error.')
    }())

    // #11
    ;(function invalidPdfMediaArgument() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'media': 'paper' })
      } catch (err) {
        if (err.reason === 'paper is not a valid argument for media option.') {
          return
        }
        throw err
      }
      throw new Error('invalid argument for pdf media option should cause error.')
    }())

    // #12
    ;(function invalidPdfPageSizeArgument() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'page-size': 'really big' })
      } catch (err) {
        if (err.reason === 'really big is not a valid argument for page-size option.') {
          return
        }
        throw err
      }
      throw new Error('invalid argument for pdf page-size option should cause error.')
    }())

    // #13
    ;(function invalidPdfPageMarginArgument() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'page-margin': 25 })
      } catch (err) {
        if (err.reason === '25 is not a valid argument for page-margin option.') {
          return
        }
        throw err
      }
      throw new Error('invalid argument for pdf page-margin option should cause error.')
    }())

    // #14
    ;(function invalidPdfProfileArgument() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'pdf-profile': 'bad-profile' })
      } catch (err) {
        if (err.reason === 'bad-profile is not a valid argument for pdf-profile option.') {
          return
        }
        throw err
      }
      throw new Error('invalid argument for pdf pdf-profile option should cause error.')
    }())

    // #15
    ;(function invalidPdfKeyBitsArgument() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'key-bits': 41 })
      } catch (err) {
        if (err.reason === 'Argument for key-bits option must be the number 40 or 128.') {
          return
        }
        throw err
      }
      throw new Error('invalid argument for pdf key bits option should cause error.')
    }())

    // #16
    ;(function PdfStringArgumentBadChars() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'user-password': '\'<script>you\'ve been powned</script>' })
      } catch (err) {
        if (err.reason === 'Invalid string argument \'<script>you\'ve been powned</script> (dashes, underscores, periods and alpha numeric characters only)') {
          return
        }
        throw err
      }
      throw new Error('pdf option with argument type string and bad characters should cause error.')
    }())

    // #17
    ;(function PdfStringArgumentTooLong() {
      try {
        job.addOutput('my_pdf', 'pdf', ['my_template'], { 'user-password': 'this-string-is-longer-than-thirty-characters' })
      } catch (err) {
        if (err.reason === 'Argument for user-password must be less than 30 characters long.') {
          return
        }
        throw err
      }
      throw new Error('pdf option with argument type string longer than 30 chars should cause error.')
    }())

    return true

  }
}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
