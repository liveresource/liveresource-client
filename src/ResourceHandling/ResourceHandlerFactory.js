var utils = require('utils');
var ResourceHandler = require('ResourceHandling/ResourceHandler');

class ResourceHandlerFactory {
    constructor(engine) {
        this.engine = engine;
        this._resources = {};
    }

    getHandlerForUri(uri) {
        return utils.getOrCreateKey(this._resources, uri, () => new ResourceHandler(this, uri));
    }
}

module.exports = ResourceHandlerFactory;