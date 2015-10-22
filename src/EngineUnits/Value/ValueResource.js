var ResourceBase = require('EngineUnits/ResourceBase');

class ValueResource extends ResourceBase {
    constructor(resourceHandler) {
        super(resourceHandler);
        this.started = false;
        this.etag = null;
        this.valueWaitUri = null;
        this.multiplexWaitUri = null;
        this.multiplexWebSocketUri = null;
    }
}

module.exports = ValueResource;