'use strict';

const async = require('src/Async');
const log = require('src/interfaces/Log').getLogger('src.parsers.dice.dd');
const util = require('util');

const AbstractParser = require('src/parsers/AbstractParser');
const MUSH = require('src/interfaces/TableMUSH');
const Mersenne = require('mersenne');
const Token = require('src/models/Token');
const Tokenizer = require('src/Tokenizer');

class dd extends AbstractParser {
    constructor (options) {
        super(options);

        this.options.verbose = !~['false', '0', 'no'].indexOf(this.options.verbose);
//        this.options.verbose = ~['true', '1', 'yes'].indexOf(this.options.verbose);

        this.stack = [];
        this.results = [];
        this.discarded = [];
        this.parsed = [];
    }

    analyzeRolls () {
        if (this.options.lowest > 0) {
            let lowest = [];

            this.results.sort();
            this.results.forEach((result, idx) => {
                if (idx < this.options.lowest) {
                    lowest.push(result);
                }
                else {
                    this.discarded.push(result);
                }
            });

            this.results = lowest;
        }

        if (this.options.highest > 0) {
            let highest = [];

            this.results.sort();
            this.results.reverse();
            this.results.forEach((result, idx) => {
                if (idx < this.options.highest) {
                    highest.push(result);
                }
                else {
                    this.discarded.push(result);
                }
            });

            this.results = highest;
            this.results.reverse();
        }
    }

    compare (roll) {
        switch (this.comparison) {
            case '>': return roll.total > this.target; break;
            case '>=': return roll.total >= this.target; break;
            case '<': return roll.total < this.target; break;
            case '<=': return roll.total <= this.target; break;
            case '=': return roll.total == this.target; break;
        }
    }

    *parse () {
        this.tokenizer.prepare(this.options.roll);

        let next = async(this.parseNextToken, this);
        yield next();

        this.parsed.unshift({
            roll: this.options.roll,
            total: this.reduce(),
            results: this.results,
            discarded: this.discarded
        });
        return this.parsed;
    }

    *parseNextToken () {
        let token = this.tokenizer.getNextToken();

        if (token instanceof Token && token != Tokenizer.EOSTOKEN) {
            let parse = async(this.parseToken, this);
            yield parse(token);

            let next = async(this.parseNextToken, this);
            yield next();
        }
    }

    *parseToken (token) {
        let method = util.format('token%s', token.type);

        let parse = async(this[method], this);
        yield parse(token.value);
    }

    reduce () {
        this.stack = this.stack.concat(this.results);
        
        let sum = this.stack.pop();
        let n = this.stack.pop();
        
        while (n) {
            if (this.types.Target.test(n)) {
                this.target = sum;
                sum = this.stack.pop();
                this.comparison = n;
            }
            else {
                sum += n;
            }

            n = this.stack.pop();
        }

        return sum;
    }

    roll (sides) {
        let result = Mersenne.rand(sides) + 1;

        if (+this.options.reroll > 0 && result <= +this.options.reroll) {
            this.discarded.push(result);
            return this.roll(sides);
        }

//        this.stack.push(result);
        this.results.push(result);
    }

    *tokenAdd () {}
    *tokenComment () {}

    *tokenNumber (number) {
        this.stack.push(parseInt(number));
    }

    *tokenRepeat (amount) {
        amount = parseInt(amount) - 1;

        while (amount--) {
            let options = Object.assign({}, this.options, {
                roll: this.options.roll.replace(/\d+x/g, '')
            });

            let instance = new dd(options, {});
            let parser = async(instance.parse, instance);
            let results = yield parser();
            this.parsed = this.parsed.concat(results);
        }
    }

    *tokenRoll (roll) {
        let index = roll.indexOf('d');
        let dice = parseInt(roll.substring(0, index));
        let sides = parseInt(roll.substring(index + 1));

        while (dice--) {
            this.roll(sides);
        }

        this.analyzeRolls();
/*
        let total = this.results.reduce((total, value) => {
            return (total + value);
        }, 0);

        this.stack.push(total);
*/
    }

    *tokenSubtract () {
        let token = this.tokenizer.getNextToken();
        let parse = async(this.parseToken, this);

        yield parse(token);

        let operand = this.stack.pop();
        this.stack.push(operand * -1);
    }

    *tokenTarget (operator) {
        this.stack.push(operator);
    }

    get types () {
        return {
            Repeat: /^\s*(\d+x)/i,
            Comment: /^\s*(\(.+?\))/,
            Roll: /^\s*(\d+d\d+)/i,
            Subtract: /^\s*(-)/i,
            Add: /^\s*(\+)/,
            Number: /^\s*(\d+)/i,
            Target: /^\s*(>=|<=|<|>|=)/
        };
    }

    toMUSH (dbref) {

        let messages = [];

        this.parsed.forEach((roll) => {
            let extras = [];
            if (this.comparison) extras.push(this.compare(roll) ? '[ansi(<#90C090>, Success)]' : '[ansi(<#900000>, Failure)]');
            if (this.options.verbose) extras.push(util.format('Rolls: \\[%j\\]', roll.results));
            if (this.options.verbose && roll.discarded.length) extras.push(util.format('Discarded: \\[%j\\]', roll.discarded));
            if (this.options.verbose && this.options.lowest) extras.push('Lowest: ' + this.options.lowest);
            if (this.options.verbose && this.options.highest) extras.push('Highest: ' + this.options.highest);
            if (this.options.verbose && this.options.reroll) extras.push('Reroll: ' + this.options.reroll);

            let message = util.format('[name(%s)] rolls %s: %s', dbref, roll.roll, roll.total);
            if (extras.length) {
                message += ' (' + extras.join(', ') + ')';
            }
            messages.push(message);
        });

        MUSH.getInstance().pemit(dbref, util.format('\\[[ansi(<#00A0F0>,webroll)]\\] %s', messages.join('\n[space(10)]')));
        MUSH.getInstance().oemit(dbref, util.format('\\[[ansi(<#00A0F0>,webroll)]\\] %s', messages.join('\n[space(10)]')));
    }
}

module.exports = dd;
