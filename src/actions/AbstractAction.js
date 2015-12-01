'use strict';

class AbstractAction {
    constructor (context) {
        this.context = context;
    }

    *init () {
        throw new Error('No action defined for this route.');
    }
}

module.exports = AbstractAction;