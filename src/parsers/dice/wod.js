'use strict';

const AbstractParser = require('src/parsers/AbstractParser');
const MUSH = require('src/interfaces/TableMUSH');
const Mersenne = require('mersenne');
const Token = require('src/models/Token');
const Tokenizer = require('src/Tokenizer');

const async = require('src/Async');
const util = require('util');

class wod extends AbstractParser {
    constructor (options) {
        super(options);

        this.options.verbose = !~['false', '0', 'no'].indexOf(this.options.verbose);

        this.stack = [];
        this.results = [];
        this.parsed = [];
    }

    analyzeRolls (rolls, rerolls, results) {
        const reroll = this.options.again || 10;
        const weakness = this.options.weakness || 0;

        results.forEach((roll) => {
            let cv;
            if (roll.hit && roll.rote) {
                cv = `[ansi(<#FFFF00>, ${roll.rote})]`;
            }
            else if (roll.hit && roll.roll >= reroll) {
                cv = `[ansi(<#005FFF>, ${roll.roll})]`;
            }
            else if (roll.hit) {
                cv = `[ansi(<#90C090>, ${roll.roll})]`;
            }
            else if (roll.roll <= weakness) {
                cv = `[ansi(<#900000>, ${roll.roll})]`;
            } else {
                cv = `${roll.roll}`;
            }

            if (!roll.reroll) rolls.push(cv);
            else rerolls.push(cv);
        });
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

        let dice = this.stack.reduce((a, b) => a + b, 0);
        if (dice <= 0) {
            this.options.chance = true;
            this.options.target = 10;
            dice = 1;
        }

        while (dice--) this.roll();
        this.parsed.unshift({
            roll: this.options.roll,
            total: this.reduce(),
            results: this.results
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
        return this.results.reduce((total, result) => {
            if (result.hit) total++;
            if (result.weaken) total--;
            return total;
        }, 0);
    }

    roll (re) {
        const roll = Mersenne.rand(10) + 1;
        const reroll = this.options.again || 10;

        const target = this.options.target || 8;
        const weakness = this.options.weakness || 0;
        const rote = this.options.rote || false;

        const result = {
            roll,
            reroll: re || false,
            hit: roll >= target,
            weaken: roll <= weakness
        };

        if (roll < target && rote) {
            result.rote = Mersenne.rand(10) + 1;
            result.hit = (result.rote >= target);
        }

        if (result.roll >= reroll || result.rote >= reroll) this.roll(true);

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

            let instance = new wod(options, {});
            let parser = async(instance.parse, instance);
            let results = yield parser();
            this.parsed = this.parsed.concat(results);
        }
    }

    *tokenSubtract (number) {
        this.stack.push(parseInt(number) * -1);
    }

    get types () {
        return {
            Repeat: /^\s*(\d+x)/i,
            Comment: /^\s*(\(.+?\))/,
            Subtract: /^\s*-\s*?(\d+)/,
            Add: /^\s*(\+)/,
            Number: /^\s*(\d+)/

        };
    }

    toMUSH (dbref) {
        let messages = [];

        if (!this.invalid) {
            this.parsed.forEach((roll) => {
                let extras = [];
                let rolls = [];
                let rerolls = [];

                this.analyzeRolls(rolls, rerolls, roll.results);

                if (this.comparison) extras.push(this.compare(roll.total) ? '[ansi(<#90C090>, Success)]' : '[ansi(<#900000>, Failure)]');
                if (this.options.verbose) extras.push(`Rolls: ${rolls}`);
                if (this.options.verbose && rerolls.length) extras.push(`Rerolls: ${rerolls}`);
                if (this.options.target) extras.push(`Target: ${this.options.target}`);
                if (this.options.again) extras.push(`Again: ${this.options.again}`);
                if (this.options.weakness) extras.push(`Weakness: ${this.options.weakness}`);
                if (this.options.private) extras.push('Private');
                if (this.options.chance) extras.push('Chance Roll!');
                if (this.options.gm) { extras.push('Results Hidden'); this.options.private = true; }

                let message = `[name(${dbref})] rolls ${roll.roll}: ${roll.total} successes`;
                if (extras.length) {
                    message += ' (' + extras.join(', ') + ')';
                }
                messages.push(message);
            });
        } else {
            this.options.private = true;
            messages.push('Invalid syntax.');
        }

        MUSH.getInstance().pemit(dbref, util.format('\\[[ansi(<#00A0F0>,webroll)]\\] %s', messages.join('\n[space(10)]')));

        if (!this.options.private) {
            MUSH.getInstance().oemit(dbref, util.format('\\[[ansi(<#00A0F0>,webroll)]\\] %s', messages.join('\n[space(10)]')));
        }
        else if (this.options.gm) {
            MUSH.getInstance().oemit(dbref, util.format('\\[[ansi(<#00A0F0>,webroll)]\\] [name(%s)] rolls some dice behind the DM screen.', dbref));
        }
    }
}

module.exports = wod;
