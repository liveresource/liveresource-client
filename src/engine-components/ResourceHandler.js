var utils = require('../utils');
var debug = require('console');

var Engine = require('./Engine');
var ChangesAspect = require('./ChangesAspect');
var ValueAspect = require('./ValueAspect');

const VALUE_EVENTS = ['value', 'removed'];
const CHANGES_EVENTS = ['child-added', 'child-removed']

// "static" resources field
var _resources = {};

class ResourceHandler {
    constructor(uri) {
        this.uri = uri;

        this.valueAspect = new ValueAspect();
        this.changesAspect = new ChangesAspect();

        this._liveResources = [];
    }

    addLiveResource(liveResource) {
        this._liveResources.push(liveResource);
    }

    removeLiveResource(liveResource) {
        utils.removeFromArray(this._liveResources, liveResource);
    }

    trigger() {
        var args = utils.copyArray(arguments);
        var count = this._liveResources.length;
        for (var i = 0; i < count; i++) {
            var liveResource = this._liveResources[i];
            liveResource._events.trigger.apply(liveResource._events, args);
        }
    }

    addEvent(type) {
        if (utils.isInArray(VALUE_EVENTS, type)) {
            this.addValueEvent();
        } else if (utils.isInArray(CHANGES_EVENTS, type)) {
            this.addChangesEvent()
        } else {
            throw "unknown event type";
        }
    }

    addValueEvent() {
        var self = this;
        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            self.valueAspect.updateFromHeaders(self.uri, headers);

            if (code >= 200 && code < 400) {
                // 304 if not changed, don't trigger value
                if (code < 300) {
                    self.trigger('value', self, result);
                }
                if (self.valueAspect.etag) {
                    Engine().addObjectResource(self);
                } else {
                    debug.info('no etag');
                }
                request = null;
            } else if (code >= 400) {
                if (code == 404) {
                    self.trigger('removed', self);
                    request = null;
                } else {
                    request.retry();
                }
            }
        });
        request.start('GET', this.uri);
    }

    addChangesEvent() {
        var self = this;
        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            self.changesAspect.updateFromHeaders(self.uri, headers);

            if (code >= 200 && code < 300) {
                // 304 if not changed, don't trigger changes
                if (code < 300) {
                    for (var n = 0; n < result.length; ++n) {
                        if (result[n].deleted) {
                            self.trigger('child-deleted', self, result[n]);
                        } else {
                            self.trigger('child-added', self, result[n]);
                        }
                    }
                }
                if (self.changesAspect.changesWaitUri) {
                    Engine().addCollectionResource(self);
                    if (!self.changesAspect.started) {
                        self.changesAspect.started = true;
                        self.trigger('ready', self);
                    }
                    request = null;
                } else {
                    debug.info('no changes-wait link');
                }
            } else if (code >= 400) {
                request.retry();
            }
        });
        request.start('HEAD', this.uri);
    }

    static getHandlerForUri(uri) {
        if (!(uri in _resources)) {
            _resources[uri] = new ResourceHandler(uri);
        }
        return _resources[uri];
    }
}

module.exports = ResourceHandler;