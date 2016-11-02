import * as Logger from "../Logger";

class ResourceHandler {
    constructor(engine, uri) {
        this._engine = engine;
        this.uri = uri;

        // The "parts" of this resource.
        this._resourceParts = [];

        // References to the "LiveResource" instances
        // that are pointed to by this resource handler
        this._liveResources = [];

        // TODO: "once only" events need to go away.
        // 'ready' is the only one using this right now, and
        // it's not the right way.
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

    forEachLiveResource(callback) {
        this._liveResources.forEach(liveResource => callback(liveResource));
    }

    triggerOnceOnlyEvent(event, target, ...args) {
        this._onceOnlyEvents.set(event, {target, args});
        this.checkOnceOnlyEvents();
    }

    checkOnceOnlyEvents() {
        Logger.info("Checking once only events...");

        this._onceOnlyEvents.forEach(({target, args}, event) => {
            this._liveResources.forEach(liveResource => {
                const processedEvents = this._onceOnlyEventMap.get(liveResource);
                if (processedEvents.indexOf(event) < 0) {
                    processedEvents.push(event);
                    liveResource._events.trigger(event, target, ...args);
                }
            });
        });
    }

    addEvent(type) {
        const engineUnit = this._engine.findEngineUnitForEvent(type);
        const interestType = engineUnit != null ? engineUnit.interestType : null;
        if (interestType != null) {
            this.getOrAddResourcePart(interestType, type => engineUnit.createResourcePart(this));
        }

        this.checkOnceOnlyEvents();
    }

    getOrAddResourcePart(interestType, createFunc) {
        if (interestType != null) {
            var resourcePart = this._resourceParts.find(part => part.interestType == interestType);
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