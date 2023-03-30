const { job, log } = require('decorators')

class JobTest {

  @log
  @job('*/2 * * * *', { name: 'hello_job', weight: 1 })
  maintenance({ context, runtime }) {
    return {
      context,
      runtime,
      value: 'hello from overwritten job'
    }
  }

}

module.exports = JobTest
