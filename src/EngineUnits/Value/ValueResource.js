var utils = require('utils');

var ValueEngineUnit = require('EngineUnits/Value/ValueEngineUnit');
var ResourceBase = require('EngineUnits/ResourceBase');

class ValueResource extends ResourceBase {
    constructor(uri, etag, valueWaitUri, multiplexWaitUri, multiplexWebSocketUri) {
        super(uri);
        this.etag = etag;
        this.valueWaitUri = valueWaitUri;
        this.multiplexWaitUri = multiplexWaitUri;
        this.multiplexWebSocketUri = multiplexWebSocketUri;
    }
}

module.exports = ValueResource;