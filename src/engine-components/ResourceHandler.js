var ResourceHandler = function (uri) {
    if (!(this instanceof ResourceHandler)) {
        throw new window.Error("Constructor called as a function");
    }
    this._uri = uri;
    this._started = false;
    this._etag = null;
    this._valueWaitUri = null;
    this._changesWaitUri = null;
    this._multiplexWsUri = null;

    this._liveResources = [];
};

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
        if(type == 'value' || type == 'removed') {
            var self = this;

            var request = new Pollymer.Request();
            request.on('finished', function(code, result, headers) {

                var etag = null;
                var valueWaitUri = null;
                var multiplexWaitUri = null;
                var multiplexWsUri = null;

                utils.forEachOwnKeyValue(headers, function(key, header) {

                    var lkey = key.toLowerCase();
                    if (lkey == 'etag') {
                        etag = header;
                    } else if (lkey == 'link') {
                        var links = utils.parseLinkHeader(header);
                        if (links && links['value-wait']) {
                            valueWaitUri = utils.toAbsoluteUri(self._uri, links['value-wait']['href']);
                        }
                        if (links && links['multiplex-wait']) {
                            multiplexWaitUri = utils.toAbsoluteUri(self._uri, links['multiplex-wait']['href']);
                        }
                        if (links && links['multiplex-ws']) {
                            multiplexWsUri = utils.mapHttpUrlToWebSocketUrl(utils.toAbsoluteUri(self._uri, links['multiplex-ws']['href']));
                        }
                    }

                });

                if (etag) {
                    debug.info('etag: [' + etag + ']');
                    self._etag = etag;
                }

                if (valueWaitUri) {
                    debug.info('value-wait: [' + valueWaitUri + ']');
                    self._valueWaitUri = valueWaitUri;
                }

                if (multiplexWaitUri) {
                    debug.info('multiplex-wait: [' + multiplexWaitUri + ']');
                }

                if (multiplexWsUri) {
                    debug.info('multiplex-ws: [' + multiplexWsUri + ']');
                    self._multiplexWsUri = multiplexWsUri;
                }

                if(code >= 200 && code < 400) {
                    // 304 if not changed, don't trigger value
                    if (code < 300) {
                        self.trigger('value', self, result);
                    }
                    if (self._etag) {
                        Engine.getSharedEngine().addObjectResource(self, self._uri, self._etag, self._valueWaitUri, multiplexWaitUri, self._multiplexWsUri);
                    }
                    request = null;
                } else if(code >= 400) {
                    if (code == 404) {
                        if (this._started) {
                            self.trigger('removed', self);
                        }
                        request = null;
                    } else {
                        request.retry();
                    }
                }
            });
            request.start('GET', this._uri);

        } else if(type == 'child-added' || type == 'child-deleted') {

            // Collection section of spec
            var self = this;

            var request = new Pollymer.Request();
            request.on('finished', function(code, result, headers) {

                var changesWaitUri = null;

                utils.forEachOwnKeyValue(headers, function(key, header) {

                    var lkey = key.toLowerCase();
                    if (lkey == 'link') {
                        var links = utils.parseLinkHeader(header);
                        if (links && links['changes-wait']) {
                            changesWaitUri = links['changes-wait']['href'];
                        }
                    }

                });

                if (changesWaitUri) {
                    debug.info('changes-wait: [' + changesWaitUri + ']');
                    self._changesWaitUri = changesWaitUri;
                }

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
                    if (self._changesWaitUri) {
                        Engine.getSharedEngine().addCollectionResource(self, self._uri, self._changesWaitUri);
                        if (!self._started) {
                            self._started = true;
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
            request.start('HEAD', this._uri);
        }
    }
});

utils.extend(ResourceHandler, {
    _resources: {},
    get: function(uri) {
        if (!(uri in this._resources)) {
            this._resources[uri] = new ResourceHandler(uri);
        }
        return this._resources[uri];
    }
});
