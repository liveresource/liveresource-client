var utils = require('utils');
var debug = require('console');

var ChangesAspect = require('Aspects/Changes/ResourceHandling/ChangesAspect');
var ValueAspect = require('Aspects/Value/ResourceHandling/ValueAspect');

const VALUE_EVENTS = ['value', 'removed'];
const CHANGES_EVENTS = ['child-added', 'child-removed']

class ResourceHandler {
    constructor(engine, uri) {
        this._engine = engine;

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

        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            this.valueAspect.updateFromHeaders(this.uri, headers);

            if (code >= 200 && code < 400) {
                // 304 if not changed, don't trigger value
                if (code < 300) {
                    this.trigger('value', this, result);
                }
                if (this.valueAspect.etag) {
                    this._engine.addObjectResource(this);
                } else {
                    debug.info('no etag');
                }
                request = null;
            } else if (code >= 400) {
                if (code == 404) {
                    this.trigger('removed', this);
                    request = null;
                } else {
                    request.retry();
                }
            }
        });
        request.start('GET', this.uri);
    }

    addChangesEvent() {

        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            this.changesAspect.updateFromHeaders(this.uri, headers);

            if (code >= 200 && code < 300) {
                // 304 if not changed, don't trigger changes
                if (code < 300) {
                    for (var n = 0; n < result.length; ++n) {
                        if (result[n].deleted) {
                            this.trigger('child-deleted', this, result[n]);
                        } else {
                            this.trigger('child-added', this, result[n]);
                        }
                    }
                }
                if (this.changesAspect.changesWaitUri) {
                    this._engine.addCollectionResource(this);
                    if (!this.changesAspect.started) {
                        this.changesAspect.started = true;
                        this.trigger('ready', this);
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
}

module.exports = ResourceHandler;