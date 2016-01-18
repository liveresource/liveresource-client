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
        if (interestType != null && !(interestType in this._resourceAspects)) {
            this._resourceAspects[interestType] = engineUnit.start(this);
        }

        this.checkOnceOnlyEvents();
    }

    getResourcePart(interestType) {
        return (interestType != null && interestType in this._resourceAspects) ?
            this._resourceAspects[interestType] : null;
    }
}

export default ResourceHandler;