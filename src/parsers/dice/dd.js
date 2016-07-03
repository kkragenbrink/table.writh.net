'use strict';

const AbstractParser = require('src/parsers/AbstractParser');
const MUSH = require('src/interfaces/TableMUSH');
const Mersenne = require('mersenne');
const Random = require('src/interfaces/Random');
const Token = require('src/models/Token');
const Tokenizer = require('src/Tokenizer');

const async = require('src/Async');
const util = require('util');

class dd extends AbstractParser {
    constructor (options) {
        super(options);

        this.options.verbose = !~['false', '0', 'no'].indexOf(this.options.verbose);

        this.stack = [];
        this.results = [];
        this.discarded = [];
        this.parsed = [];

        this.random = new Random();
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
            case '<>':
            case '!=': return roll.total != this.target;
            case '>': return roll.total > this.target;
            case '>=': return roll.total >= this.target;
            case '<': return roll.total < this.target;
            case '<=': return roll.total <= this.target;
            case '=': return roll.total == this.target;
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
        try {
            let token = this.tokenizer.getNextToken();

            if (token instanceof Token && token != Tokenizer.EOSTOKEN) {
                let parse = async(this.parseToken, this);
                yield parse(token);

                let next = async(this.parseNextToken, this);
                yield next();
            }
        }
        catch (e) {
            this.invalid = true;
        }
    }

    *parseToken (token) {
        let method = util.format('token%s', token.type);

        let parse = async(this[method], this);
        yield parse(token.value);
    }

    reduce () {
        this.stack = this.results.concat(this.stack);

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

    *roll (sides, dice) {
        let next = async(this.random.rand, this.random);
        let results = yield next(sides, dice);

        if (+this.options.reroll > 0) {
            const rerolls = results.filter((result) => result <= +this.options.reroll);
            if (rerolls.length > 0) {
                results = results.filter((result) => result > +this.options.reroll);
                this.discarded = this.discarded.concat(rerolls);
                let next = async(this.roll, this);
                yield next(sides, rerolls.length);
            }
        }

        this.results = this.results.concat(results);
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

        if (dice > 30) {
            throw new Error('You may not roll more than 30 dice at a time.');
        }

        if (sides > 1000) {
            throw new Error('You may not roll dice of sides greater than 1000.');
        }

        let next = async(this.roll, this);
        yield next(sides, dice);

        this.analyzeRolls();
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
            Target: /^\s*(<>|!=|>=|<=|<|>|=)/
        };
    }

    toMUSH (dbref) {
        let messages = [];

        if (!this.invalid) {
            this.parsed.forEach((roll) => {
                let extras = [];
                if (this.comparison) extras.push(this.compare(roll) ? '[ansi(<#90C090>, Success)]' : '[ansi(<#900000>, Failure)]');
                if (this.options.verbose) extras.push(util.format('Rolls: \\[%j\\]', roll.results));
                if (this.options.verbose && roll.discarded.length) extras.push(util.format('Discarded: \\[%j\\]', roll.discarded));
                if (this.options.verbose && this.options.lowest) extras.push('Lowest: ' + this.options.lowest);
                if (this.options.verbose && this.options.highest) extras.push('Highest: ' + this.options.highest);
                if (this.options.verbose && this.options.reroll) extras.push('Reroll: ' + this.options.reroll);
                if (this.options.private) extras.push('Private');
                if (this.options.dm) {
                    extras.push('Results Hidden');
                    this.options.private = true;
                }

                let message = util.format('[name(%s)] rolls %s: %s', dbref, roll.roll, roll.total);
                if (extras.length) {
                    message += ' (' + extras.join(', ') + ')';
                }
                messages.push(message);
            });
        } else {
            this.options.private = true;
            messages.push('Invalid syntax.');
        }

        MUSH.getInstance().pemit(dbref, util.format('\\[[ansi(<#73A6B5>,webroll)]\\] %s', messages.join('\n[space(10)]')));

        if (!this.options.private) {
            MUSH.getInstance().oemit(dbref, util.format('\\[[ansi(<#73A6B5>,webroll)]\\] %s', messages.join('\n[space(10)]')));
        }
        else if (this.options.dm) {
            MUSH.getInstance().oemit(dbref, util.format('\\[[ansi(<#73A6B5>,webroll)]\\] [name(%s)] rolls some dice behind the DM screen.', dbref));
        }
    }
}

module.exports = dd;
