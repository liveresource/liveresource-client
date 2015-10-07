var utils = require('utils');

class EngineUnit {
    constructor() {
        this.engine = null;
        this._resources = {};
    }

    update() {
    }

    addResourceHandler(resourceHandler, createResource) {
        var resource = utils.getOrCreateKey(this._resources, resourceHandler.uri, createResource);
        resource.owners.push(resourceHandler);
        return resource;
    }

    get interestType() {
        return null;
    }
}

module.exports = EngineUnit;