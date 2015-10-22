var utils = require('utils');
var debug = require('console');

class ResourceHandler {
    constructor(engine, uri) {
        this._engine = engine;
        this.uri = uri;

        this._resourceAspects = {};
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
        var engineUnit = this._engine.findEngineUnitForEvent(type);
        var interestType = engineUnit != null ? engineUnit.interestType : null;
        if (interestType != null && !(interestType in this._resourceAspects)) {
            this._resourceAspects[interestType] = engineUnit.start(this);
        }

        this.checkOnceOnlyEvents();
    }

    getResourceAspectForInterestType(interestType) {
        return (interestType != null && interestType in this._resourceAspects) ?
            this._resourceAspects[interestType] : null;
    }
}

module.exports = ResourceHandler;