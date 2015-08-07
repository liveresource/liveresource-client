var LiveResource = require('ResourceHandling/LiveResource');

class LiveResourceFactory {
    constructor(resourceHandlerFactory) {
        this._resourceHandlerFactory = resourceHandlerFactory;
    }

    getLiveResourceClass() {
        var factory = this;
        return class {
            constructor(uri) {
                return new LiveResource(factory._resourceHandlerFactory, uri);
            }
        };
    }
}

module.exports = LiveResourceFactory;