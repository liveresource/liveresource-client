var utils = require('utils');
var debug = require('console');

class ResourceHandler {
    constructor(resourceHandlerFactory, uri) {
        this.resourceHandlerFactory = resourceHandlerFactory;
        this.uri = uri;

        this._aspects = {};
        this._liveResources = [];
    }

    addLiveResource(liveResource) {
        this._liveResources.push(liveResource);
    }

    removeLiveResource(liveResource) {
        utils.removeFromArray(this._liveResources, liveResource);
    }

    trigger(event, target, ...args) {
        var count = this._liveResources.length;
        for (var i = 0; i < count; i++) {
            var liveResource = this._liveResources[i];
            liveResource._events.trigger(event, target, ...args);
        }
    }

    addEvent(type) {
        var interestType = this.resourceHandlerFactory.findInterestTypeForEvent(type);
        if (!(interestType in this._aspects)) {
            var aspectClass = this.resourceHandlerFactory.getAspectClass(interestType);
            if (aspectClass != null) {
                var aspect = new aspectClass(this);
                this._aspects[interestType] = aspect;
                aspect.start();
            }
        }
    }
}

module.exports = ResourceHandler;