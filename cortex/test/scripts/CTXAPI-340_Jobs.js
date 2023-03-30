const { job, log } = require('decorators')

class JobTest {

  @log
  @job('*/1 * * * *', { name: 'hello_job' })
  maintenance({ context, runtime }) {
    return {
      context,
      runtime,
      value: 'hello from job'
    }
  }

}

module.exports = JobTest
