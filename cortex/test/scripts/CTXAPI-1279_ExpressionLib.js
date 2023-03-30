const { expressions: { expression } } = require('decorators')

class AwesomeExpressions {

    /**
     * expression
     */
    @expression
    aexp__pick_values = { $pick: ['$$ROOT', 'email', 'mobile'] }

}

module.exports = AwesomeExpressions
