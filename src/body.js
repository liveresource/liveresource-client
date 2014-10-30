// Takes an object and a predicate.
// Iterates all keys directly defined on the object
// (not through prototype chain) and calls predicate
// with key and value. Also, if predicate returns false,
// break out of the loop.
var forEachOwnKeyValue = function(obj, predicate, ctx) {
    for(var key in obj) {
        if (obj.hasOwnProperty(key)) {
            var result = predicate.call(ctx || this, key, obj[key]);
            if (typeof(result) != 'undefined' && !result) {
                break;
            }
        }
    }
};

var getOrCreateKey = function(obj, key, defaultValue) {
    if (!(key in obj)) {
        obj[key] = defaultValue;
    }
    return obj[key];
};

var beginsWith = function(str, find) {
    return str.substring(0, find.length) == find;
};
var replaceStart = function(str, find, replace) {
    return replace + str.substring(find.length);
};

var mapHttpUrlToWebSocketUrl = function(uri) {
    var absoluteUri = utils.toAbsoluteUri(window.location.href, uri);

    var converted = absoluteUri;
    if (beginsWith(absoluteUri, "http://")) {
        converted = replaceStart(absoluteUri, "http://", "ws://");
    } else if (beginsWith(absoluteUri, "https://")) {
        converted = replaceStart(absoluteUri, "https://", "wss://");
    }

    if (!beginsWith(converted, "ws://") && !beginsWith(converted, "wss://")) {
        throw "not valid";
    }

    return converted;
};

var mapWebSocketUrlToHttpUrl = function(url) {
    var converted = url;
    if (beginsWith(url, "ws://")) {
        converted = replaceStart(url, "ws://", "http://");
    } else if (beginsWith(url, "wss://")) {
        converted = replaceStart(url, "wss://", "https://");
    }

    if (!beginsWith(converted, "http://") && !beginsWith(converted, "https://")) {
        throw "not valid";
    }

    return converted;
};

var nextUpdate = function(predicate, ctx) {
    return window.setTimeout(function() {
        predicate.apply(ctx);
    }, 0);
};

var Engine = function () {
    this._resources = {};
    this._timer = null;
    this._multiplexWebSocketConnections = {};
    this._multiplexWaitConnections = {};
    this._valueWaitConnections = {};
    this._changesWaitConnections = {};
};
Engine.prototype._getPreferredEndpointsForResources = function(resources) {
    var valueWaitEndpoints = {};
    var multiplexWsEndpoints = {};
    var multiplexWaitEndpoints = {};
    var changeWaitPolls = {};

    forEachOwnKeyValue(resources, function(resUri, res) {
        if (res.changesWaitUri) {
            changeWaitPolls[res.changesWaitUri] = res;
        } else {
            if (res.multiplexWsUri) {
                var endpoint = getOrCreateKey(multiplexWsEndpoints, res.multiplexWsUri, { items: [] });
                endpoint.items.push(res);
            } else if (res.multiplexWaitUri) {
                var endpoint = getOrCreateKey(multiplexWaitEndpoints, res.multiplexWaitUri, { items: [] });
                endpoint.items.push(res);
            } else {
                valueWaitEndpoints[res.valueWaitUri] = res;
            }
        }
    });

    var result = {
        valueWaitEndpoints: {},
        multiplexWebsocketEndpoints: {},
        multiplexWaitEndpoints: {},
        changesWaitEndpoints: {}
    };

    forEachOwnKeyValue(multiplexWsEndpoints, function(endpointUri, endpoint) {
        result.multiplexWebsocketEndpoints[endpointUri] = { endpointUri: endpointUri, items: endpoint.items };
    });
    forEachOwnKeyValue(multiplexWaitEndpoints, function(endpointUri, endpoint) {
        if (endpoint.items.length > 1 || !endpoint.items[0].valueWaitUri) {
            result.multiplexWaitEndpoints[endpointUri] = { endpointUri: endpointUri, items: endpoint.items };
        } else {
            valueWaitEndpoints[endpoint.items[0].valueWaitUri] = endpoint.items[0];
        }
    });
    forEachOwnKeyValue(valueWaitEndpoints, function(endpointUri, endpoint) {
        result.valueWaitEndpoints[endpointUri] = { endpointUri: endpointUri, item: endpoint };
    });
    forEachOwnKeyValue(changeWaitPolls, function(endpointUri, endpoint) {
        result.changesWaitEndpoints[endpointUri] = { endpointUri: endpointUri, item: endpoint };
    });

    return result;
};
Engine.prototype.updateValueItem = function(resource, headers, body) {

    forEachOwnKeyValue(headers, function(key, header) {
        var lowercaseKey = key.toLocaleLowerCase();
        if (lowercaseKey == 'etag') {
            resource.etag = header;
            return false;
        }
    });

    for (var i = 0; i < resource.owners.length; i++) {
        var owner = resource.owners[i];
        owner.trigger('value', owner, body);
    }

};
Engine.prototype.updateValueItemMultiplex = function(resources, uri, headers, body) {
    forEachOwnKeyValue(resources, function(resourceUri, resource) {
        if (resourceUri == uri) {

            this.updateValueItem(resource, headers, body);

        }
    }, this);
};
Engine.prototype._createMultiplexWebsocketConnection = function(endpointUri) {
    var _this = this;
    var connection = {
        uri: endpointUri,
        socket: new WebSockHop(endpointUri),
        subscribedItems: {},
        isConnected: false,
        isRetrying: false,
        subscribe: function(uri) {
            this.socket.request({
                type: 'subscribe',
                mode: 'value',
                uri: uri
            }, function (result) {
                if (result.type == 'subscribed') {
                    connection.subscribedItems[uri] = uri;
                }
            });
        },
        unsubscribe: function(uri) {
            this.socket.request({
                type: 'unsubscribe',
                mode: 'value',
                uri: uri
            }, function (result) {
                if (result.type == 'unsubscribed') {
                    delete connection.subscribedItems[uri];
                }
            })
        },
        mapToHttpUri: function(uri) {
            var absoluteUri = utils.toAbsoluteUri(this.uri, uri);
            var httpUri = mapWebSocketUrlToHttpUrl(absoluteUri);
            return httpUri;
        },
        checkSubscriptions: function(items) {

            var endpointUri = this.uri;
            debug.info("Multiplex Ws Request URI: " + endpointUri);

            var subscribedItems = {};
            forEachOwnKeyValue(this.subscribedItems, function(uri, value) {
                subscribedItems[uri] = value;
            });

            for(var i = 0; i < items.length; i++) {
                var httpUri = this.mapToHttpUri(items[i].uri);
                if (httpUri in subscribedItems) {
                    delete subscribedItems[httpUri];
                } else {
                    this.subscribe(httpUri);
                }
            }

            forEachOwnKeyValue(subscribedItems, function(uri) {
                this.unsubscribe(uri);
            });

        },
        close: function() {
            if (this.isConnected) {
                this.socket.close();
            } else {
                this.socket.abort();
            }
        }
    };

    connection.socket.formatter = new WebSockHop.JsonFormatter();

    connection.socket.on("opened", function() {
        connection.socket.on("message", function(data) {

            var uri = data.uri;
            var absoluteUri = utils.toAbsoluteUri(endpointUri, uri);
            var httpUri = mapWebSocketUrlToHttpUrl(absoluteUri);

            _this.updateValueItemMultiplex(_this._resources, httpUri, data.headers, data.body);

        });
        connection.subscribedItems = {};
        connection.isConnected = true;
        connection.isRetrying = false;

        _this._update();
    });

    connection.socket.on("closed", function() {
        connection.isConnected = false;
        connection.isRetrying = false;
    });

    connection.socket.on("error", function() {
        connection.isConnected = false;
        connection.isRetrying = true;
    });

    return connection;
};
Engine.prototype._createValueWaitConnection = function(endpointUri, item) {
    var self = this;
    var poll = {
        uri: endpointUri,
        request: new Pollymer.Request(),
        res: item,
        isActive: false
    };
    poll.request.on("finished", function(code, result, headers) {
        poll.isActive = false;
        self._onFinishedValueWaitRequest(poll, code, result, headers);
    });
    return poll;
};
Engine.prototype._onFinishedValueWaitRequest = function(poll, code, result, headers) {

    if (code >= 200 && code < 300) {

        this.updateValueItem(poll.res, headers, result);

    }

    this._update();
};
Engine.prototype._createMultiplexWaitConnection = function(endpointUri, items) {
    var self = this;
    var poll = {
        uri: endpointUri,
        request: new Pollymer.Request(),
        resItems: items,
        isActive: false
    };
    poll.request.on("finished", function(code, result, headers) {
        poll.isActive = false;
        self._onFinishedMultiplexWait(poll, code, result, headers);
    });
    return poll;
};
Engine.prototype._onFinishedMultiplexWait = function(poll, code, result, headers) {

    if (code >= 200 && code < 300) {

        forEachOwnKeyValue(result, function (uri, item) {

            debug.info('got data for uri: ' + uri);

            var absoluteUri = utils.toAbsoluteUri(poll.uri, uri);

            this.updateValueItemMultiplex(this._resources, absoluteUri, item.headers, item.body);

        }, this);

    }

    this._update();
};
Engine.prototype._createChangesWaitConnection = function(endpointUri, item) {
    var self = this;
    var poll = {
        uri: endpointUri,
        request: new Pollymer.Request(),
        res: item,
        isActive: false
    };
    poll.request.on("finished", function(code, result, headers) {
        poll.isActive = false;
        self._onFinishedChangesWait(poll, code, result, headers);
    });
    return poll;
};
Engine.prototype._onFinishedChangesWait = function (poll, code, result, headers) {

    if (code >= 200 && code < 300) {

        forEachOwnKeyValue(headers, function(key, header) {

            var lkey = key.toLowerCase();
            if (lkey == 'link') {
                var links = utils.parseLinkHeader(header);
                if (links && links['changes-wait']) {
                    poll.res.changesWaitUri = links['changes-wait']['href'];
                    return false;
                }
            }

        });

        for (var i = 0; i < poll.res.owners.length; i++) {
            var owner = poll.res.owners[i];

            for (var n = 0; n < result.length; ++n) {
                if (result[n].deleted) {
                    owner.trigger('child-deleted', owner, result[n]);
                } else {
                    owner.trigger('child-added', owner, result[n]);
                }
            }
        }
    }

    this._update();
};

Engine.prototype._update = function () {
    if (!this._timer) {
        this._timer = nextUpdate(function () {

            this._timer = null;
            var _this = this;

            // restart our long poll
            debug.info('engine: setup long polls');

            var adjustEndpoints = function(label, currentConnectionsMap, preferredEndpointsMap, changeTest, abortConnection, newConnection, refreshConnection) {

                // currentConnectionsMap = endpointUri -> connection
                // preferredEndpointsMap = endpointUri -> endpoint

                // Keep track of list of new endpoints to enable
                var newEndpoints = {};
                forEachOwnKeyValue(preferredEndpointsMap, function(endpointUri, endpoint) {
                    newEndpoints[endpointUri] = endpoint;
                });

                // Make a list of endpoints to disable...
                var endpointsToDisable = [];
                forEachOwnKeyValue(currentConnectionsMap, function(endpointUri, connection) {
                    // This item is already known, so remove endpoint from "new endpoints".
                    delete newEndpoints[endpointUri];

                    var removedOrChanged = false;
                    if (!(endpointUri in preferredEndpointsMap)) {
                        // If item is not in the preferred endpoints map, then it has been
                        // removed. Mark for disabling.
                        removedOrChanged = true;
                    } else {
                        // If item is in the preferred endpoints map, then
                        // call "changeTest" to decide whether this item has changed.
                        var endpoint = preferredEndpointsMap[endpointUri];
                        removedOrChanged = changeTest(endpoint, connection);
                    }
                    if (removedOrChanged) {
                        // If marked, add to "delete" list
                        endpointsToDisable.push(endpointUri);
                    }
                });

                // ... and disable them.
                for (var i = 0; i < endpointsToDisable.length; i++) {
                    var endpointUri = endpointsToDisable[i];
                    debug.info("Remove '" + label + "' endpoint - '" + endpointUri + "'.");
                    var connection = currentConnectionsMap[endpointUri];
                    abortConnection(connection);
                    delete currentConnectionsMap[endpointUri];
                }

                // Create new requests for endpoints that need them.
                // They will be created with isActive set to false.
                forEachOwnKeyValue(newEndpoints, function(endpointUri, endpoint) {
                    debug.info("Adding '" + label + "' endpoint - '" + endpointUri + "'.");
                    var connection = newConnection(endpoint);
                    currentConnectionsMap[endpointUri] = connection;
                }, this);

                // For any current endpoint, start them up if
                // they are not currently marked as being isActive.
                forEachOwnKeyValue(currentConnectionsMap, function(endpointUri, connection) {
                    var endpoint = preferredEndpointsMap[endpointUri];
                    refreshConnection(connection, endpoint);
                });
            };

            var preferredEndpoints = this._getPreferredEndpointsForResources(this._resources);

            adjustEndpoints(
                "Multiplex WS",
                this._multiplexWebSocketConnections,
                preferredEndpoints.multiplexWebsocketEndpoints,
                function(endpoint, connection) {
                    return endpoint.items.length == 0;
                },
                function(connection) { connection.socket.abort(); },
                function(endpoint) { return _this._createMultiplexWebsocketConnection(endpoint.endpointUri); },
                function(connection, endpoint) {
                    if (connection.isConnected) {
                        connection.checkSubscriptions(endpoint.items);
                    }
                }
            );

            adjustEndpoints(
                "Value Wait",
                this._valueWaitConnections,
                preferredEndpoints.valueWaitEndpoints,
                function(endpoint, connection) { return endpoint.item.uri != connection.res.uri; },
                function(connection) { connection.request.abort(); },
                function(endpoint) { return _this._createValueWaitConnection(endpoint.endpointUri, endpoint.item); },
                function(connection) {
                    if (!connection.isActive) {
                        var requestUri = connection.uri;
                        debug.info("Value Wait Request URI: " + requestUri);
                        connection.request.start('GET', requestUri, { 'If-None-Match': connection.res.etag, 'Wait': 55 });
                        connection.isActive = true;
                    }
                }
            );

            adjustEndpoints(
                "Multiplex Wait",
                this._multiplexWaitConnections,
                preferredEndpoints.multiplexWaitEndpoints,
                function(endpoint, connection) {
                    var removedOrChanged = false;
                    if (endpoint.items.length != connection.resItems.length) {
                        removedOrChanged = true
                    } else {
                        var preferredEndpointItemUris = [];
                        for (var i = 0; i < endpoint.items.length; i++) {
                            preferredEndpointItemUris.push(endpoint.items[i].uri);
                        }
                        preferredEndpointItemUris.sort();

                        var pollResourceItemUris = [];
                        for (var i = 0; i < connection.resItems.length; i++) {
                            pollResourceItemUris.push(connection.resItems[i].uri);
                        }
                        pollResourceItemUris.sort();

                        for (var i = 0; i < preferredEndpointItemUris.length; i++) {
                            if (preferredEndpointItemUris[i] != pollResourceItemUris[i]) {
                                removedOrChanged = true;
                                break;
                            }
                        }
                    }
                    return removedOrChanged;
                },
                function (connection) { connection.request.abort(); },
                function (endpoint) { return _this._createMultiplexWaitConnection(endpoint.endpointUri, endpoint.items.slice()); },
                function (connection) {
                    if (!connection.isActive) {
                        var urlSegments = [];
                        for (var i = 0; i < connection.resItems.length; i++) {
                            var res = connection.resItems[i];
                            var uri = res.uri;
                            urlSegments.push('u=' + encodeURIComponent(uri) + '&inm=' + encodeURIComponent(res.etag));
                        }
                        var requestUri = connection.uri + '?' + urlSegments.join('&');

                        debug.info("Multiplex Wait Request URI: " + requestUri);
                        connection.request.start('GET', requestUri, { 'Wait': 55 });
                        connection.isActive = true;
                    }
                }
            );

            adjustEndpoints(
                "Changes Wait",
                this._changesWaitConnections,
                preferredEndpoints.changesWaitEndpoints,
                function(endpoint, connection) { return endpoint.item.uri != connection.res.uri; },
                function(connection) { connection.request.abort(); },
                function(endpoint) { return _this._createChangesWaitConnection(endpoint.endpointUri, endpoint.item); },
                function(connection) {
                    if (!connection.isActive) {
                        var requestUri = connection.uri;
                        debug.info("Changes Wait Request URI: " + requestUri);
                        connection.request.start('GET', requestUri, { 'Wait': 55 });
                        connection.isActive = true;
                    }
                }
            );

        }, this);
    }
};

Engine.prototype._getOrCreateResource = function (uri) {
    if (!(uri in this._resources)) {
        this._resources[uri] = {
            uri: uri,
            owners: []
        };
    }
    return this._resources[uri];
};

Engine.prototype.addObjectResource = function (owner, uri, etag, valueWaitUri, multiplexWaitUri, multiplexWsUri) {
    var res = this._getOrCreateResource(uri);
    res.owners.push(owner);
    res.etag = etag;
    res.valueWaitUri = valueWaitUri;
    res.multiplexWaitUri = multiplexWaitUri;
    res.multiplexWsUri = multiplexWsUri;
    this._update();
};

Engine.prototype.addCollectionResource = function (owner, uri, changesWaitUri) {
    var res = this._getOrCreateResource(uri);
    res.owners.push(owner);
    res.changesWaitUri = changesWaitUri;
    this._update();
};

var engine = new Engine();

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
ResourceHandler._resources = {};
ResourceHandler.get = function(uri) {
    if (!(uri in this._resources)) {
        this._resources[uri] = new ResourceHandler(uri);
    }
    return this._resources[uri];
};
ResourceHandler.prototype.addLiveResource = function(liveResource) {
    this._liveResources.push(liveResource);
};
ResourceHandler.prototype.removeLiveResource = function(liveResource) {
    utils.removeFromArray(this._liveResources, liveResource);
};
ResourceHandler.prototype.trigger = function() {
    var args = utils.copyArray(arguments);
    var count = this._liveResources.length;
    for(var i = 0; i < count; i++) {
        var liveResource = this._liveResources[i];
        liveResource._events.trigger.apply(liveResource._events, args);
    }
};
ResourceHandler.prototype.addEvent = function(type) {
    if(type == 'value' || type == 'removed') {
        var self = this;

        var request = new Pollymer.Request();
        request.on('finished', function(code, result, headers) {

            var etag = null;
            var valueWaitUri = null;
            var multiplexWaitUri = null;
            var multiplexWsUri = null;

            forEachOwnKeyValue(headers, function(key, header) {

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
                        multiplexWsUri = mapHttpUrlToWebSocketUrl(utils.toAbsoluteUri(self._uri, links['multiplex-ws']['href']));
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
                    engine.addObjectResource(self, self._uri, self._etag, self._valueWaitUri, multiplexWaitUri, self._multiplexWsUri);
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

            forEachOwnKeyValue(headers, function(key, header) {

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
                    engine.addCollectionResource(self, self._uri, self._changesWaitUri);
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
};

var LiveResource = function (uri) {
    if (!(this instanceof LiveResource)) {
        throw new window.Error("Constructor called as a function");
    }

    this._events = new Events();

    var absoluteUri = utils.toAbsoluteUri(window.location.href, uri);
    this._resourceHandler = ResourceHandler.get(absoluteUri);
    this._resourceHandler.addLiveResource(this);
};
LiveResource.prototype.on = function (type, handler) {
    this._events.on(type, handler);
    this._resourceHandler.addEvent(type);
};
LiveResource.prototype.off = function (type, handler) {
    var args = utils.copyArray(arguments, 1);
    args.unshift(type);
    this._events.off.apply(this._events, args);
};

var exports = LiveResource;