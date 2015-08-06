var utils = require('utils');
var getWindowLocationHref = require('utils.getWindowLocationHref');
var debug = require('console');

var Events = require('engine-components/Events');
var ResourceHandler = require('engine-components/ResourceHandler');

class LiveResource {
    constructor(uri) {
        this._events = new Events();

        var windowLocationHref = getWindowLocationHref();
        var absoluteUri = utils.toAbsoluteUri(windowLocationHref, uri);
        this._resourceHandler = ResourceHandler.getHandlerForUri(absoluteUri);
        this._resourceHandler.addLiveResource(this);
    }

    on(type, handler) {
        this._events.on(type, handler);
        this._resourceHandler.addEvent(type);
    }

    off(type, handler) {
        var args = utils.copyArray(arguments, 1);
        args.unshift(type);
        this._events.off.apply(this._events, args);
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