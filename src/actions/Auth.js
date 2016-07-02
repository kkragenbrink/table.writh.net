'use strict';

const async = require('src/Async');

const POST_METHOD = 'POST';

const AbstractAction = require('src/actions/AbstractAction');
const MUSH = require('src/interfaces/TableMUSH');

const log = require('src/interfaces/Log').getLogger('src.actions.Auth');

class Auth extends AbstractAction {
    *init () {
        let valid = this.isValidUser();

        if (!valid) {
            let login = async(this.validate, this);
            valid = yield login();
        }

        return valid;
    }

    getUserToken () {
        this.context.user = JSON.parse(this.context.cookies.get('auth', {
            signed: true,
            //secure: true
        }));

        return this.context.user;
    }

    isValidUser () {
        return !!this.getUserToken();
    }

    *validate () {
        if (this.context.method === POST_METHOD && this.context.request.body) {
            let user = this.context.request.body.user;
            let pass = this.context.request.body.pass;

            let valid = yield MUSH.getInstance().checkPass(user, pass);
            if (valid) {
                let expiration = new Date();
                expiration.setHours(expiration.getHours() + 24);

                this.context.body = {
                    dbref: yield MUSH.getInstance().getDbref(user),
                    name: yield MUSH.getInstance().getName(user)
                };

                this.context.cookies.set('auth', JSON.stringify(this.context.body), {
                    signed: true,
                    //secure: true,
                    expires: expiration
                });

                return true;
            }
        }

        this.context.status = 401;
        this.context.body = '"Invalid credentials."';
        return false;
    }
}

module.exports = Auth;
