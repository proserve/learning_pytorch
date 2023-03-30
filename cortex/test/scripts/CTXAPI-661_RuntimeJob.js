const { job, log } = require('decorators'),
      cache = require('cache')

class JobCtxApi661 {

  @log
  @job('*/1 * * * *', {
    name: 'c_ctxapi661_job_conditional',
    if: {
      $cache: '661_job_is_on'
    }
  })
  jobCtxapi661() {
    cache.set('CTXAPI-661-hello', 'hello from job ctx661')
  }

}

module.exports = JobCtxApi661
