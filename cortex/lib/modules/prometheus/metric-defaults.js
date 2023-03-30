const consts = require('../../consts'),
      { GAUGE, COUNTER, HISTOGRAM } = consts.prometheus.metricType,

      defaultCustomMetrics = [
        { type: GAUGE, data: { name: consts.prometheus.SANDBOX_CURRENT_EXECUTIONS_TOTAL, help: 'Number of scripts currently running on the sandbox', labelNames: ['env', 'org'] } },
        { type: COUNTER, data: { name: consts.prometheus.SANDBOX_IPC_MESSAGES_TOTAL, help: 'Number of messages exchanged between the main process and the sandboxes', labelNames: ['env', 'org', 'code'] } },
        { type: COUNTER, data: { name: consts.prometheus.SANDBOX_EXECUTIONS_TOTAL, help: 'Number of scripts executed on the sandbox', labelNames: ['env', 'org', 'type'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.SANDBOX_EXECUTIONS_DURATION_SECONDS, help: 'Duration of scripts executed on the sandbox', labelNames: ['env', 'org'] } },
        { type: COUNTER, data: { name: consts.prometheus.SANDBOX_EXECUTIONS_TIMEOUTS_TOTAL, help: 'Scripts that have failed to execute due to a timeout', labelNames: ['env', 'org'] } },
        { type: COUNTER, data: { name: consts.prometheus.SANDBOX_EXECUTION_ERRORS_TOTAL, help: 'Scripts that have failed to execute', labelNames: ['env', 'org', 'statusCode'] } },
        // Triggers
        { type: COUNTER, data: { name: consts.prometheus.TRIGGERS_EXECUTION_TOTAL, help: 'Total number of triggers executed', labelNames: ['env', 'org', 'statusCode', 'filename'] } },
        { type: GAUGE, data: { name: consts.prometheus.TRIGGERS_BACKLOG_TOTAL, help: 'Total number of triggers in the backlog', labelNames: ['env', 'org', 'statusCode'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.TRIGGERS_EXECUTION_DURATION_SECONDS, help: 'Trigger processing duration in seconds', labelNames: ['env', 'org', 'filename'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.TRIGGERS_EXECUTION_LATENCY_SECONDS, help: 'Trigger processing latency in seconds', labelNames: ['env', 'org', 'filename'] } },
        // Jobs
        { type: COUNTER, data: { name: consts.prometheus.JOBS_EXECUTION_TOTAL, help: 'Total number of jobs executed', labelNames: ['env', 'org', 'statusCode', 'filename'] } },
        { type: GAUGE, data: { name: consts.prometheus.JOBS_BACKLOG_TOTAL, help: 'Total number of jobs in the backlog', labelNames: ['env', 'org', 'statusCode'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.JOBS_EXECUTION_DURATION_SECONDS, help: 'Job processing duration in seconds', labelNames: ['env', 'org', 'filename'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.JOBS_EXECUTION_LATENCY_SECONDS, help: 'Job processing latency in seconds', labelNames: ['env', 'org', 'filename'] } },
        // Library
        { type: COUNTER, data: { name: consts.prometheus.LIBRARY_EXECUTION_TOTAL, help: 'Total number of libraries executed', labelNames: ['env', 'org', 'statusCode', 'filename'] } },
        { type: GAUGE, data: { name: consts.prometheus.LIBRARY_BACKLOG_TOTAL, help: 'Total number of library executions in the backlog', labelNames: ['env', 'org', 'statusCode'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.LIBRARY_EXECUTION_DURATION_SECONDS, help: 'Library processing duration in seconds', labelNames: ['env', 'org', 'filename'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.LIBRARY_EXECUTION_LATENCY_SECONDS, help: 'Library processing duration in seconds', labelNames: ['env', 'org', 'filename'] } },
        // Routes
        { type: COUNTER, data: { name: consts.prometheus.ROUTES_EXECUTION_TOTAL, help: 'Total number of custom routes executed', labelNames: ['env', 'org', 'statusCode', 'filename'] } },
        { type: GAUGE, data: { name: consts.prometheus.ROUTES_BACKLOG_TOTAL, help: 'Total number of routes in the backlog', labelNames: ['env', 'org', 'statusCode'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.ROUTES_EXECUTION_DURATION_SECONDS, help: 'Route processing duration in seconds', labelNames: ['env', 'org', 'filename'] } },
        { type: HISTOGRAM, data: { name: consts.prometheus.ROUTES_EXECUTION_LATENCY_SECONDS, help: 'Route processing latency in seconds', labelNames: ['env', 'org', 'filename'] } }

      ]

module.exports = defaultCustomMetrics
