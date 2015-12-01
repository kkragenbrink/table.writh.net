'use strict';

const AbstractAction = require('src/actions/AbstractAction');

class Test extends AbstractAction {
    *init () {
        this.context.body = '"Test."';
        this.status = 200;
    }
}

module.exports = Test;