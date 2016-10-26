import { toAbsoluteUri } from '../utils';
import { getWindowLocationHref } from '../utils.getWindowLocationHref';

import Events from './Events';
import CollectionEntry from './CollectionEntry';

class LiveResource {
    constructor(staticClass, engine, uri, options) {
        this._events = new Events();
        this._engine = engine;

        if (typeof uri == "object") {
            options = uri;
            uri = undefined;
        }

        options = options || {};

        const resourceUri = uri || options.uri;
        this._parser = options.parser;

        // staticClass is a reference to the "class" used in global scope, e.g., Liveresource.options
        // This is a hacky way of setting options on the engine, may want to revisit
        engine.setGlobalOptions(staticClass.options);

        const windowLocationHref = getWindowLocationHref();
        const absoluteUri = toAbsoluteUri(windowLocationHref, resourceUri);
        this._resourceHandler = engine.getHandlerForUri(absoluteUri);
        this._resourceHandler.addLiveResource(this);
    }

    parse(interestType, headers, data) {
        return this._parser ? this._parser(interestType, headers, data) : this._engine.defaultParser(interestType, headers, data);
    }

    on(type, handler) {
        const event = this._events.on(type, handler);
        this._resourceHandler.addEvent(type);
        return () => {
            event();
            // Also remove from resource handler
        };
    }

    trigger(event, target, ...args) {
        this._events.trigger(event, target, ...args);
    }

    cancel() {
        this._events = null;
        if (this._resourceHandler != null) {
            this._resourceHandler.removeLiveResource(this);
            this._resourceHandler = null;
        }
    }

    static createLiveResourceConstructorWithEngine(engine) {
        const LiveResourceClass = class {
            constructor(uri, options) {
                return new LiveResource(this.constructor, engine, uri, options);
            }
        };
        // TODO: Probably better to do this another way.
        // This is flaky.
        LiveResourceClass.options = {
            longPollTimeoutMsecs: 0,
            maxLongPollDelayMsecs: 0
        };
        LiveResourceClass.CollectionEntry = CollectionEntry;
        return LiveResourceClass;
    }
}

export default LiveResource;