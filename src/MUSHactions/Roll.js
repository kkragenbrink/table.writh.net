'use strict';

const AbstractAction = require('src/MUSHactions/AbstractAction');

const fs = require('fs');
const async = require('src/Async');
const util = require('util');

const parsers = [];
class Roll extends AbstractAction {
    *init (path) {
        if (parsers.length === 0) {
            const files = fs.readdirSync('src/parsers/dice/');
            files.forEach((file) => {
                file = file.substr(0, file.indexOf('.'));
                parsers.push(file);
            });
        }

        let options = {};
        path.forEach((part) => {
            if (~part.indexOf(':')) {
                part = part.split(':');
                options[part[0]] = part[1];
            }
            else if (~parsers.indexOf(part)){
                options.type = part;
            }
            else {
                options[part] = true;
            }
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
