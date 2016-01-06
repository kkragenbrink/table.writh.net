'use strict';

const Mersenne = require('mersenne');
const MUSH = require('src/interfaces/TableMUSH');

const util = require('util');

class Flip {
    constructor () {
        this.result = null;
    }

    *parse () {
        this.result = Mersenne.rand(2) ? 'Heads' : 'Tails';
        return this.result;
    }

    toMUSH (dbref) {
        MUSH.getInstance().oemit(dbref, util.format('\\[[ansi(<#00A0F0>, webroll)]\\] [name(%s)] flips a coin: %s', dbref, this.result));
        MUSH.getInstance().pemit(dbref, util.format('\\[[ansi(<#00A0F0>, webroll)]\\] You flip a coin: %s', this.result));
    }
}

module.exports = Flip;
