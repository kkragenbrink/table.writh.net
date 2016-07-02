'use strict';

const Driver = require('lokijs');

class Database {
    constructor (config) {
        this.db = new Driver(config.database.name, {
            autosave: true,
            autosaveInterval: 10,
            autoload: true
        });
    }

    collection (collection) {
        let coll = this.db.getCollection(collection);

        if (!coll) {
            coll = this.db.addCollection(collection);
        }

        return coll;
    }

    getParser () {
        const db = this;
        return function *parser (next) {
            this.db = db;
            yield next;
        };
    }
}

module.exports = Database;
