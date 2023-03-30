const should = require('should'),
      WorkerQueue = require('../../../../lib/modules/workers/worker-queue')

describe('CTXAPI-1944 - Fix WorkerQueue queueCantLockMessage error handling', function() {

  it('WorkerQueue _process method should return queueCantLockMessage error', function(done) {

    const context = {
            options: {},
            collection: {
              // returns error within _processed method
              findOneAndDelete: (find, options, callback) => {
                callback({
                  errCode: 'cortex.error.queueCantLockMessage'
                })
              }
            },
            _error: (err, message, callback) => {
              should.exist(err)
              err.errCode.should.equal('cortex.error.queueCantLockMessage')
              callback()
            },
          },
          message = {
            scheduled: false
          }

    WorkerQueue.prototype._processed.call(context, message, {}, {}, done)

  })

})
