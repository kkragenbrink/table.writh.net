'use strict';

const async = require('src/Async');
const log = require('src/interfaces/Log').getLogger('src.Router');
const util = require('util');
const uuid = require('uuid');

const Auth = require('src/actions/Auth.js');
const BodyParser = require('koa-json-body');

class Router {
    constructor (app, config, db) {
        this.app = app;
        this.config = config;
        this.db = db;

        this.app.name = config.app.name;

        try {
            this.app.use(BodyParser());

            this.app.use(db.getParser());
            this.app.use(Router.time);
            this.app.use(Router.reqLog);
            this.app.use(Router.auth);
            this.app.use(Router.route);
        }
        catch (e) {
            this.status = 500;
            this.body = e;
        }
    }

    static *time (next) {
        let start = new Date;
        yield next;

        let stop = new Date - start;
        this.set('X-Response-Time', stop + 'ms');
    }

    static *reqLog (next) {
        let id = uuid.v4();
        let start = new Date;
        log.info('%s -> %s %s', id, this.method, this.path);
        yield next;

        let stop = new Date - start;
        log.info('%s <- %s %s %d %dms', id, this.method, this.path, this.status, stop);
    }

    static *auth (next) {
        this.type = 'application/json';

        this.request.req.connection.encrypted = true; // FIXME: Workaround for being behind a proxy.

        let auth = new Auth(this);

        if (this.method === 'POST') {
            const authenticate = async(auth.init, auth);
            yield authenticate();
        }

        if (!auth.isValidUser()) {
            return this.body;
        }

        yield next;
    }

    static *route (next) {
        let path = this.path
            .slice(1)
            .replace(/%20/g, ' ')
            .split('/');

        let action = path.shift();
        action = action.charAt(0).toUpperCase() + action.slice(1);

        try {
            let Action = require(util.format('src/actions/%s', action));
            let instance = new Action(this);
            let handler = async(instance.init, instance);
            yield handler(path);
        }
        catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                this.status = 404;
            }
            else if (e.status) {
                this.status = e.status;
            }
            else {
                this.status = 500;
            }

            this.body = util.format('"%s"', e.code || e.message || 'An unidentified error has occurred.');
            return this.body;
        }
        yield next;
    }
}

module.exports = Router;
