'use strict';

class Token {
    constructor (value, type) {
        Object.defineProperty(this, 'props', {
            configurable: false,
            enumerable: false,
            value: {
                value: value,
                type: type
            },
            writable: false
        });
    }

    get value () { return this.props.value; }
    get type () { return this.props.type; }

    toString () {
        return {
            value: this.props.value,
            type: this.props.type
        };
    }
}

module.exports = Token;
