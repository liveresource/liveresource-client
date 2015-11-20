var utils = require('utils');
var debug = require('console');

var ConnectionBase = require('EngineUnits/ConnectionBase');

class ChangesWaitConnection extends ConnectionBase {
    constructor(engineUnit, endpoint) {
        super(engineUnit);

        this.uri = endpoint.endpointUri;
        this.request = engineUnit.createLongPoll();
        this.res = endpoint.item;
        this.isActive = false;

        this.request.on("finished", (code, result, headers) => {
            this.isActive = false;

            if (code >= 200 && code < 300) {
                engineUnit.updateResource(this.res, headers, result);
            }

            this._engineUnit.updateEngine();
        });
    }

    hasChanged(endpoint) {
        return this.res.resourceHandler.uri != endpoint.item.resourceHandler.uri;
    }

    abort() {
        this.request.abort();
    }

    refresh(endpoint) {
        if (!this.isActive) {
            var requestUri = this.uri;
            debug.info(`Changes Wait Request URI: ${requestUri}`);
            this._engineUnit.setLongPollOptions(this.request);
            this.request.start('GET', requestUri, {
                'Wait': 55
            });
            this.isActive = true;
        }
    }
}

module.exports = ChangesWaitConnection;