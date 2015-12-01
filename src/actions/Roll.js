'use strict';

const async = require('src/Async');
const util = require('util');

const AbstractAction = require('src/actions/AbstractAction');

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
        this.context.body = yield parser();

        let cookie = JSON.parse(this.context.cookies.get('auth', {signed: true}));
        instance.toMUSH(cookie.dbref);
    }
}

module.exports = Roll;
