var ResourceHandlerFactory = require('ResourceHandling/ResourceHandlerFactory');
var LiveResource = require('ResourceHandling/LiveResource');

class LiveResourceFactory {
    constructor(engine) {
        this.resourceHandlerFactory = new ResourceHandlerFactory(engine);
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