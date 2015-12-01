'use strict';

const fs = require('fs');
const log = require('src/interfaces/Log').getLogger('src.Sheets');
const path = require('path');
const yaml = require('js-yaml');

const Log = require('src/interfaces/Log');
const MUSH = require('src/interfaces/TableMUSH');
const Server = require('src/Server');

class Main {
    constructor () {
        log.trace('constructor');

        this.config = {};

        process.on('SIGINT', this.stop.bind(this));
        process.on('SIGTERM', this.stop.bind(this));
    }

    init () {
        log.trace('init');

        fs.readFile(path.resolve('cnf/server.yml'), (err, rawConfig) => {
            if (this.server) {
                this.server.stop();
                delete this.server;
            }

            this.config = yaml.load(rawConfig);
            Log.configure(this.config);

            this.server = new Server(this.config);
            this.server.start();

            this.mush = MUSH.getInstance();
            this.mush.configure(this.config);
            this.mush.connect();
        });
    }

    stop () {
        log.trace('stop');

        this.mush.disconnect();
        this.server.stop();
        process.exit();
    }
}

module.exports = Main;
