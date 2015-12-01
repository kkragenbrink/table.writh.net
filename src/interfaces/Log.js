'use strict';

const winston = require('winston');
winston.trace = winston.Logger.prototype.trace = winston.log.bind(winston, 'trace');

class Log {
    static configure (config) {
        winston.level = config.log.levels.default;

        winston.remove(winston.transports.Console);
        winston.add(winston.transports.Console, {
            timestamp: true,
            colorize: true
        });

        for (var name in config.log.levels) {
            if (name === 'default') continue;

            winston.loggers.add(name, {
                console: {
                    level: config.log.levels[name]
                }
            });
        }

    }

    static getLogger (name) {
        if (winston.loggers.loggers[name]) {
            return winston.loggers.get(name);
        }
        return winston;
    }
}

module.exports = Log;