'use strict';

const Token = require('src/models/Token');

const EOS_TOKEN = new Token(null, 'EOS');

class Tokenizer {
    constructor(definitions) {
        Object.defineProperty(this, 'types', {
            configurable: false,
            enumerable: false,
            value: definitions,
            writable: false
        });

        Object.defineProperty(this, 'stream', {
            configurable: false,
            enumerable: false,
            value: null,
            writable: true
        });
    }

    prepare (input) {
        this.stream = input;
    }

    static get EOSTOKEN () {
        return EOS_TOKEN;
    }

    getNextToken () {
        if (this.stream.length === 0 || this.stream === null) {
            return Tokenizer.EOSTOKEN;
        }
        for (let type in this.types) {
            let expression = this.types[type];
            let matches = expression.exec(this.stream);

            if (matches) {
                let match = matches[1];
                this.stream = this.stream.substring(this.stream.indexOf(match) + match.length);

                return new Token(match, type);
            }
        }

        throw new Error('Parse error.');
    }
}

module.exports = Tokenizer;
