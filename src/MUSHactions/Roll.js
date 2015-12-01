'use strict';

const async = require('src/Async');
const util = require('util');

const AbstractAction = require('src/MUSHactions/AbstractAction');

class Roll extends AbstractAction {
    *init (path) {
        let options = {};

        path.forEach((part) => {
            part = part.split(':');
            options[part[0]] = part[1];
        });

        if (!options.type) {
            options.type = 'dd';
        }

        let model = require(util.format('src/parsers/dice/%s', options.type));
        let instance = new model(options);
        let parser = async(instance.parse, instance);
        yield parser();
        instance.toMUSH(this.executor);
    }
}

module.exports = Roll;
