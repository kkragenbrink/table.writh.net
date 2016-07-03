'use strict';

const AbstractAction = require('src/actions/AbstractAction');

const extend = require('extend');
const util = require('util');

class Character extends AbstractAction {
    constructor (c) {
        super(c);

        this.db = this.context.db.collection('characters');
    }

    *init (path) {
        this[this.context.method](path);
    }

    getCharacter (path) {
        if (path && path.length && ~path[0].indexOf(':')) {
            const find = {};

            path.forEach((p) => {
                const parts = p.split(':');
                const key = parts[0];
                const value = parts[1];
                find[key] = value;
            });

            return this.db.find(find);
        }
        else if (path && path.length && !isNaN(parseInt(path[0]))) {
            return this.db.get(+path[0]);
        }
        else if (!path) {
            return this.db.find({owner: this.context.user.dbref});
        }
    }

    GET (path) {
        this.context.body = this.getCharacter(path);
    }

    POST () {
        if (this.context.request.body && this.context.request.body['name']) {
            let character = this.db.findOne({
                name: this.context.request.body['name'],
                owner: this.context.user.dbref
            });

            if (character) {
                this.context.status = 409;
                this.context.body = '"Character already exists."';
                return;
            }

            character = this.context.request.body;
            character.owner = this.context.user.dbref;
            this.context.body = this.db.insert(character);
        }
        else {
            this.context.status = 400;
            this.context.body = '"Character data required."';
        }
    }

    PUT (path) {
        const character = this.getCharacter(path);

        if (util.isArray(character)) {
            this.context.status = 400;
            this.context.body = '"Invalid character ID."';
            return;
        }

        let data = extend(true, {}, this.context.request.body);
        delete data.meta;
        delete data.$loki;
        delete data.owner;
        extend(character, data);
        this.db.update(character);

        this.context.body = character;
    }
}

module.exports = Character;
