'use strict';

const Mersenne = require('mersenne');
const RandomOrg = require('random-org');

const log = require('./Log').getLogger('src/interfaces/Random');
const util = require('util');

const API_KEY = require('cnf/random.json').API_KEY;

class Random {
    constructor () {
        this.random = new RandomOrg({
            apiKey: API_KEY
        });
    }

    *rand (sides, dice) {

        if (!dice) dice = 1;

        return this.random
            .generateIntegers({min: 1, max: sides, n: dice})
            .then((result) => {
                log.debug(util.format('Received from random.org (bitsLeft: %d, requestsLeft: %d).', result.bitsLeft, result.requestsLeft));
                return result.random.data;
            }).catch((e) => {
                log.warn('Error receiving data from random.org. Falling back to local randomizer.');
                return this.fallback(sides, dice);
            });
    }

    fallback (sides, dice) {
        const rolls = [];

        while (dice--) {
            rolls.push(Mersenne.rand(sides) + 1);
        }

        return rolls;
    }
}

module.exports = Random;