var utils = require('utils');
var getWindowLocationHref = require('utils.getWindowLocationHref');

var Events = require('ResourceHandling/Events');

class LiveResource {
    constructor(staticClass, engine, uri) {
        this._events = new Events();

        // staticClass is a reference to the "class" used in global scope, e.g., Liveresource.options
        // This is a hacky way of setting options on the engine, may want to revisit
        engine.setGlobalOptions(staticClass.options);

        var windowLocationHref = getWindowLocationHref();
        var absoluteUri = utils.toAbsoluteUri(windowLocationHref, uri);
        this._resourceHandler = engine.getHandlerForUri(absoluteUri);
        this._resourceHandler.addLiveResource(this);
    }

    on(type, handler) {
        this._events.on(type, handler);
        this._resourceHandler.addEvent(type);
    }

    off(type, handler = null) {
        this._events.off(type, handler);
    }

    cancel() {
        this._events = null;
        if (this._resourceHandler != null) {
            this._resourceHandler.removeLiveResource(this);
            this._resourceHandler = null;
        }
    }

    static createLiveResourceConstructorWithEngine(engine) {
        var LiveResourceClass = class {
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

module.exports = LiveResource;