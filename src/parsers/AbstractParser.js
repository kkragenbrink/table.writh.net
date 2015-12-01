'use strict';

const Tokenizer = require('src/Tokenizer');

class AbstractParser {
    constructor (options) {
        Object.defineProperty(this, 'options', {
            configurable: false,
            enumerable: false,
            value: options,
            writable: false
        });

        this.tokenizer = new Tokenizer(this.types);
    }

    get types () {
        return {};
    }

    *parse () {
        throw new Error('Parser is not yet implemented.');
    }
}

module.exports = AbstractParser;