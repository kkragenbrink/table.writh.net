'use strict';

const async = require('src/Async');
const log = require('src/interfaces/Log').getLogger('src.interfaces.TableMUSH');
const net = require('net');
const util = require('util');
const uuid = require('uuid');

const Promise = require('bluebird');
const Symbol = require('symbol');

class TableMUSH {
    constructor () {
        Object.defineProperty(this, 'queue', {
            configurable: false,
            enumerable: false,
            value: [],
            writable: true
        });

        Object.defineProperty(this, 'running', {
            configurable: false,
            enumerable: false,
            value: false,
            writeable: true
        });

        Object.defineProperty(this, 'handlers', {
            configurable: false,
            enumerable: false,
            value: new Map(),
            writeable: true
        });
    }

    configure (config) {
        Object.defineProperty(this, 'config', {
            configurable: false,
            enumerable: false,
            value: config.mush,
            writable: true
        });

    }

    connect () {
        Object.defineProperty(this, 'conn', {
            configurable: false,
            enumerable: false,
            value: net.createConnection({
                host: this.config.host,
                port: this.config.port
            }),
            writable: true
        });

        this.conn.on('data', (data) => {
            if (/^@@symbol:\S+ /.test(data)) {
                data = data.toString();

                let symbol = data.substring(0, data.indexOf(' '));
                let response = data.substring(data.indexOf(' ') + 1);
                let handler = this.handlers.get(symbol);

                handler(response);
                this.handlers.delete(symbol);
            }
            else if (/^@@request:\S+ /.test(data)) {
                data = data.toString();

                let executor = data.substring(10, data.indexOf(' '));
                let request = data.substring(data.indexOf(' ') + 1).trim();

                let id = uuid.v4();
                let start = new Date;
                log.info('%s -> %s %s', id, executor, request);

                let path = request
                    .slice(1)
                    .split('/');

                let action = path.shift();
                action = action.charAt(0).toUpperCase() + action.slice(1);
                let Action = require(util.format('src/MUSHactions/%s', action));
                let instance = new Action(executor);
                let handler = async(instance.init, instance);

                handler(path).then(() => {
                    let stop = new Date - start;
                    log.info('%s <- %s %s %dms', id, executor, request, stop);
                });
            }
        });
        this.conn.once('connect', () => {
            this.conn.write(util.format('connect %s %s\n', this.config.username, this.config.password), 'utf-8');

            Object.defineProperty(this, 'interval', {
                configurable: false,
                enumerable: false,
                value: setInterval(this.run.bind(this), 10),
                writable: false
            });

        });
    }

    disconnect () {
        this.conn.write('QUIT\n');
        this.conn.end();
    }

    run () {
        if (!this.running && this.queue.length) {
            let instruction = this.queue.shift();
            let symbol = Symbol();
            this.handlers.set(symbol.toString(), instruction.handler);
            this.conn.once('data', instruction.handler);
            let command = util.format('think %s %s\n', symbol, instruction.command);
            this.conn.write(command);
        }
    }

    static getInstance () {
        if (!TableMUSH.instance) {
            Object.defineProperty(TableMUSH, 'instance', {
                configurable: false,
                enumerable: false,
                value: new TableMUSH(),
                writable: false
            });
        }

        return TableMUSH.instance;
    }

    /*** MUSH Actions ***/
    checkPass (username, password) {
        return new Promise((resolve) => {
            this.queue.push({
                command: util.format('[checkpass(*%s, %s)]', username, password),
                handler: (response) => {
                    if (response.toString().trim() === '1') {
                        return resolve(true);
                    }
                    return resolve(false);
                }
            });
        });
    }

    getDbref (username) {
        return new Promise((resolve) => {
            this.queue.push({
                command: util.format('[pmatch(%s)]', username),
                handler: (response) => {
                    resolve(response.toString().trim());
                }
            });
        });
    }

    getName (username) {
        return new Promise((resolve) => {
            this.queue.push({
                command: util.format('[name(pmatch(%s))]', username),
                handler: (response) => {
                    resolve(response.toString().trim());
                }
            });
        });
    }

    oemit (user, message) {
        return new Promise((resolve) => {
            this.queue.push({
                command: util.format('[oemit(%s, %s)]', user, message.replace(/\n/g, '%r')),
                handler: () => {
                    resolve();
                }
            });
        });
    }

    pemit (user, message) {
        return new Promise((resolve) => {
            this.queue.push({
                command: util.format('[pemit(%s, %s)]', user, message.replace(/\n/g, '%r')),
                handler: () => {
                    resolve();
                }
            });
        });
    }
}

module.exports.getInstance = TableMUSH.getInstance;

