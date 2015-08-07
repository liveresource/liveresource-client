var utils = require('utils');
var parseLinkHeader = require('utils.parseLinkHeader');
var Pollymer = require('Pollymer');

var Connection = require('engine-components/Connection');

class ChangesWaitConnection extends Connection {
    constructor(engine, endpoint) {
        super(engine);

        this.uri = endpoint.endpointUri;
        this.request = new Pollymer.Request();
        this.res = endpoint.item;
        this.isActive = false;

        this.request.on("finished", (code, result, headers) => {
            this.isActive = false;

            if (code >= 200 && code < 300) {
                this.res.updateItem(headers, result);
            }

            this._engine.update();
        });
    }

    hasChanged(endpoint) {
        return this.res.uri != endpoint.item.uri;
    }

    abort() {
        this.request.abort();
    }

    refresh(endpoint) {
        if (!this.isActive) {
            var requestUri = this.uri;
            debug.info(`Changes Wait Request URI: ${requestUri}`);
            this.request.start('GET', requestUri, {
                'Wait': 55
            });
            this.isActive = true;
        }
    }
}

module.exports = ChangesWaitConnection;