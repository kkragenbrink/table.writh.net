'use strict';

const koa = require('koa');
const log = require('src/interfaces/Log').getLogger('src/Server');

const Router = require('src/Router');

class Server {
    constructor (config) {
        log.trace('constructor');
        this.app = koa();
        this.config = config;

        this.app.keys = [this.config.app.secret, Math.random()];

        this.router = new Router(this.app, this.config);
    }

    start () {
        log.trace('start');

        this.server = this.app.listen(this.config.app.port);
        log.info('Server listening on port %s.', this.config.app.port);
    }

    stop () {
        log.trace('stop');

        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = Server;