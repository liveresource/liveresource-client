class EngineUnit {
    constructor() {
        this.engine = null;
        this._resources = {};
    }

    update() {
    }

    _getOrCreateResource(uri, resourceHandler, create) {
        if (!(uri in this._resources)) {
            this._resources[uri] = create(uri);
        }
        var resource = this._resources[uri];
        resource.owners.push(resourceHandler);
        return resource;
    }

    addResource(resourceHandler) {
    }

    get InterestType() {
        return null;
    }
}

module.exports = EngineUnit;