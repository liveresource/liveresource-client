var utils = require('utils');

class EngineUnit {
    constructor() {
        this.engine = null;
        this._resources = {};
    }

    update() {
    }

    _addResourceHandler(resourceHandler, createResource) {
        var resource = utils.getOrCreateKey(this._resources, resourceHandler.uri, createResource);
        resource.owners.push(resourceHandler);
        return resource;
    }

    addResource(resourceHandler) {
        _addResourceHandler(resourceHandler, () => {});
    }

    get InterestType() {
        return null;
    }
}

module.exports = EngineUnit;