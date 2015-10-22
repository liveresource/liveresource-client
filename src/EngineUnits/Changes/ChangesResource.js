var utils = require('utils');

var ResourceBase = require('EngineUnits/ResourceBase');

class ChangesResource extends ResourceBase {
    constructor(uri, changesWaitUri) {
        super(uri);
        this.changesWaitUri = changesWaitUri;
    }
}

module.exports = ChangesResource;