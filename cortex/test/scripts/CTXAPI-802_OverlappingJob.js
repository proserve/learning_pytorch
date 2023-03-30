const { job, log } = require('decorators'),
      debug = require('debug')

class OverlappingJob {

    @log
    @job('* * * * *', { name: 'overlapping_job' })
  running({ context, runtime }) {
    let counter = 0
    while (1) {
      debug.sleep(1000)
      counter++
      if (counter > 80) {
        break
      }
    }
    return 1
  }

}

module.exports = OverlappingJob
