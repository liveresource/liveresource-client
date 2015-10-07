var LiveResource = require('ResourceHandling/LiveResource');

class LiveResourceFactory {
    constructor(engine) {
        this._engine = engine;
    }

    getLiveResourceClass() {
        var factory = this;
        return class {
            constructor(uri) {
                return new LiveResource(factory._engine, uri);
            }
        };
    }
}

module.exports = LiveResourceFactory;