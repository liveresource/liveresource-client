var utils = require('utils');
var getWindowLocationHref = require('utils.getWindowLocationHref');

var Events = require('ResourceHandling/Events');

class LiveResource {
    constructor(resourceHandlerFactory, uri) {
        this._events = new Events();

        var windowLocationHref = getWindowLocationHref();
        var absoluteUri = utils.toAbsoluteUri(windowLocationHref, uri);
        this._resourceHandler = resourceHandlerFactory.getHandlerForUri(absoluteUri);
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
}

module.exports = LiveResource;