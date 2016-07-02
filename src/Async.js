'use strict';

const Promise = require('bluebird');

module.exports = function async (makeGenerator, context) {
    return function () {
        if (!context) context = this;
        const generator = makeGenerator.apply(context, arguments);

        function handle (result) {
            if (result.done) return Promise.resolve(result.value);

            return Promise.resolve(result.value)
                .then((res) => {
                    return handle(generator.next(res));
                }, (err) => {
                    return handle(generator.throw(err));
                });
        }

        try {
            return handle(generator.next());
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
};
