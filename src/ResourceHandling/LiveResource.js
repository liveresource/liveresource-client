import { toAbsoluteUri } from 'utils';
import getWindowLocationHref from 'utils.getWindowLocationHref';

import Events from 'ResourceHandling/Events';

class LiveResource {
    constructor(staticClass, engine, uri) {
        this._events = new Events();

        // staticClass is a reference to the "class" used in global scope, e.g., Liveresource.options
        // This is a hacky way of setting options on the engine, may want to revisit
        engine.setGlobalOptions(staticClass.options);

        const windowLocationHref = getWindowLocationHref();
        const absoluteUri = toAbsoluteUri(windowLocationHref, uri);
        this._resourceHandler = engine.getHandlerForUri(absoluteUri);
        this._resourceHandler.addLiveResource(this);
    }

    on(type, handler) {
        const event = this._events.on(type, handler);
        this._resourceHandler.addEvent(type);
        return () => {
            event();
            // Also remove from resource handler
        }
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
            constructor(uri) {
                return new LiveResource(this.constructor, engine, uri);
            }
        };
        LiveResourceClass.options = {
            longPollTimeoutMsecs: 0,
            maxLongPollDelayMsecs: 0
        };
        return LiveResourceClass;
    }
}

export default LiveResource;