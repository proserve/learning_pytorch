const { policy, route, log } = require('decorators')

class RoutePolicies {

    @policy
    static rateLimitPolicy = {
        "active": true,
        "halt": false,
        "priority": 0,
        "methods": [
          "get"
        ],
        "action": "Allow",
        "faultCode": "kAccessDenied",
        "faultStatusCode": 403,
        "faultReason": "Access denied by policy",
        "rateLimit": true,
        "rateLimitElements": [
          "ip"
        ],
        "rateLimitReason": "Too many requests.",
        "rateLimitCount": 300,
        "rateLimitWindow": 300,
        "name": "c_ratelimittest",
        "label": "ratelimittest",
        "pipeline": null,
        "paths": ['/routes/test-policy-ratelimit']
    }

}


module.exports = RoutePolicies
