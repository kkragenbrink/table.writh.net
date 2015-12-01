'use strict';

class AbstractAction {
    constructor (executor) {
        this.executor = executor;
    }

    *init () {
        throw new Error('No action defined for this route.');
    }
}

module.exports = AbstractAction;