import Connection from 'Framework/Connection';

class ValueWaitConnection extends Connection {
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
            const requestUri = this.uri;
            console.info(`Value Wait Request URI: ${requestUri}`);
            this._engineUnit.setLongPollOptions(this.request);
            this.request.start('GET', requestUri, {
                'If-None-Match': this.res.etag,
                'Wait': 55
            });
            this.isActive = true;
        }
    }
}

export default ValueWaitConnection;