var ResourceHandler = require('ResourceHandling/ResourceHandler');

class ResourceHandlerFactory {
    constructor(engine) {
        this._engine = engine;
        this._resources = {};
    }

    getHandlerForUri(uri) {
        if (!(uri in this._resources)) {
            this._resources[uri] = new ResourceHandler(this._engine, uri);
        }
        return this._resources[uri];
    }
}

module.exports = ResourceHandlerFactory;