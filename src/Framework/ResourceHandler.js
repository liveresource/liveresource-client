import { firstOrDefault } from 'utils';

class ResourceHandler {
    constructor(engine, uri) {
        this._engine = engine;
        this.uri = uri;

        // The "parts" of this resource.
        this._resourceParts = [];

        // References to the "LiveResource" instances
        // that are pointed to by this resource handler
        this._liveResources = [];

        this._onceOnlyEventMap = new WeakMap();
        this._onceOnlyEvents = new Map();
    }

    addLiveResource(liveResource) {
        this._liveResources.push(liveResource);
        this._onceOnlyEventMap.set(liveResource, []);
    }

    removeLiveResource(liveResource) {
        this._liveResources = this._liveResources.filter(x => x != liveResource);
    }

    trigger(event, target, ...args) {
        const count = this._liveResources.length;
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
        console.log("Checking once only events...");

        for (var event of this._onceOnlyEvents.keys()) {
            const {target, args} = this._onceOnlyEvents.get(event);

            for (var liveResource of this._liveResources) {
                const processedEvents = this._onceOnlyEventMap.get(liveResource);
                if (processedEvents.indexOf(event) < 0) {
                    processedEvents.push(event);
                    liveResource._events.trigger(event, target, ...args);
                }
            }

        }
    }

    addEvent(type) {
        const engineUnit = this._engine.findEngineUnitForEvent(type);
        const interestType = engineUnit != null ? engineUnit.interestType : null;
        if (interestType != null) {
            this.getOrAddResourcePart(interestType, type => engineUnit.start(this));
        }

        this.checkOnceOnlyEvents();
    }

    getOrAddResourcePart(interestType, createFunc) {
        if (interestType != null) {
            var resourcePart = firstOrDefault(this._resourceParts, part => part.interestType == interestType);
            if (resourcePart == null && createFunc != null) {
                resourcePart = { interestType, part: createFunc(interestType) };
                this._resourceParts.push(resourcePart);
            }
            return resourcePart != null ? resourcePart.part : null;
        }
        return null;
    }

    getResourcePart(interestType) {
        return this.getOrAddResourcePart(interestType, null);
    }
}

export default ResourceHandler;