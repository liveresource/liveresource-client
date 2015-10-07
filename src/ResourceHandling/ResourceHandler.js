var utils = require('utils');
var debug = require('console');

class ResourceHandler {
    constructor(resourceHandlerFactory, uri) {
        this.resourceHandlerFactory = resourceHandlerFactory;
        this.uri = uri;

        this._aspects = {};
        this._liveResources = [];

        this._onceOnlyEventMap = new WeakMap();
        this._onceOnlyEvents = new Map();
    }

    addLiveResource(liveResource) {
        this._liveResources.push(liveResource);
        this._onceOnlyEventMap.set(liveResource, []);
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

    triggerOnceOnlyEvent(event, target, ...args) {
        this._onceOnlyEvents.set(event, {target, args});
        this.checkOnceOnlyEvents();
    }

    checkOnceOnlyEvents() {
        debug.log("Checking once only events...");

        for (var event of this._onceOnlyEvents.keys()) {
            var {target, args} = this._onceOnlyEvents.get(event);

            for (var liveResource of this._liveResources) {
                var processedEvents = this._onceOnlyEventMap.get(liveResource);
                if (processedEvents.indexOf(event) < 0) {
                    processedEvents.push(event);
                    liveResource._events.trigger(event, target, ...args);
                }
            }

        }
    }

    addEvent(type) {
        var engineUnit = this.resourceHandlerFactory.engine.findEngineUnitForEvent(type);
        var interestType = engineUnit != null ? engineUnit.interestType : null;
        if (interestType != null && !(interestType in this._aspects)) {
            var aspect = engineUnit.createAspect(this);
            if (aspect != null) {
                this._aspects[interestType] = aspect;
                aspect.start();
            }
        }

        this.checkOnceOnlyEvents();
    }
}

module.exports = ResourceHandler;