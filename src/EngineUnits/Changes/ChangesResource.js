var ResourceBase = require('EngineUnits/ResourceBase');

class ChangesResource extends ResourceBase {
    constructor(resourceHandler) {
        super(resourceHandler);
        this.started = false;
        this.changesWaitUri = null;
    }
}

module.exports = ChangesResource;