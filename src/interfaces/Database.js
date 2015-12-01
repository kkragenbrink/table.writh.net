'use strict';

const Driver = require('lokijs');

class Database {
    constructor (config) {
        this.db = new Driver(config.database.name);
    }
}

module.exports = Database;
