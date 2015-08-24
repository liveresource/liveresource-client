var LiveResource = require('ResourceHandling/LiveResource');

class LiveResourceFactory {
    constructor(resourceHandlerFactory) {
        this.resourceHandlerFactory = resourceHandlerFactory;
    }

    getLiveResourceClass() {
        var factory = this;
        return class {
            constructor(uri) {
                return new LiveResource(factory.resourceHandlerFactory, uri);
            }
        };
    }
}

module.exports = LiveResourceFactory;