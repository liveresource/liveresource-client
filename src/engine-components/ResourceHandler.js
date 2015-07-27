var utils = require('../utils');
var debug = require('console');

var Engine = require('./Engine');
var ChangesAspect = require('./ChangesAspect');
var ValueAspect = require('./ValueAspect');

var ResourceHandler = function (uri) {
    if (!(this instanceof ResourceHandler)) {
        throw new window.Error("Constructor called as a function");
    }
    this.uri = uri;

    this.valueAspect = new ValueAspect();
    this.changesAspect = new ChangesAspect();

    this._liveResources = [];
};

utils.extend(ResourceHandler, {
    _resources: {},
    getHandlerForUri: function(uri) {
        if (!(uri in this._resources)) {
            this._resources[uri] = new ResourceHandler(uri);
        }
        return this._resources[uri];
    },
    valueEvents: ['value', 'removed'],
    changesEvents: ['child-added', 'child-removed']
});

utils.extend(ResourceHandler.prototype, {
    addLiveResource: function(liveResource) {
        this._liveResources.push(liveResource);
    },
    removeLiveResource: function(liveResource) {
        utils.removeFromArray(this._liveResources, liveResource);
    },
    trigger: function() {
        var args = utils.copyArray(arguments);
        var count = this._liveResources.length;
        for(var i = 0; i < count; i++) {
            var liveResource = this._liveResources[i];
            liveResource._events.trigger.apply(liveResource._events, args);
        }
    },
    addEvent: function(type) {
        if(utils.isInArray(ResourceHandler.valueEvents, type)) {
            this.addValueEvent();
        } else if(utils.isInArray(ResourceHandler.changesEvents, type)) {
            this.addChangesEvent()
        } else {
            throw "unknown event type";
        }
    },
    addValueEvent: function() {
        var self = this;
        var request = new Pollymer.Request();
        request.on('finished', function(code, result, headers) {

            self.valueAspect.updateFromHeaders(self.uri, headers);

            if(code >= 200 && code < 400) {
                // 304 if not changed, don't trigger value
                if (code < 300) {
                    self.trigger('value', self, result);
                }
                if (self.valueAspect.etag) {
                    Engine.getSharedEngine().addObjectResource(self);
                } else {
                    debug.info('no etag');
                }
                request = null;
            } else if(code >= 400) {
                if (code == 404) {
                    self.trigger('removed', self);
                    request = null;
                } else {
                    request.retry();
                }
            }
        });
        request.start('GET', this.uri);
    },
    addChangesEvent: function() {
        var self = this;
        var request = new Pollymer.Request();
        request.on('finished', function(code, result, headers) {

            self.changesAspect.updateFromHeaders(self.uri, headers);

            if(code >= 200 && code < 300) {
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
                    Engine.getSharedEngine().addCollectionResource(self);
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
});

module.exports = ResourceHandler;