var utils = require('../utils');
var debug = require('console');
var mapWebSocketUrls = require('../utils.mapWebSocketUrls');

var Engine = function () {
    if (!(this instanceof Engine)) {
        throw new window.Error("Constructor called as a function");
    }
    this._resources = {};
    this._timer = null;
    this._multiplexWebSocketConnections = {};
    this._multiplexWaitConnections = {};
    this._valueWaitConnections = {};
    this._changesWaitConnections = {};
};

utils.extend(Engine.prototype, {
    _getPreferredEndpointsForResources: function(resources) {
        var valueWaitEndpoints = {};
        var multiplexWebSocketEndpoints = {};
        var multiplexWaitEndpoints = {};
        var changeWaitPolls = {};

        utils.forEachOwnKeyValue(resources, function(resUri, res) {
            if (res.changesWaitUri) {
                changeWaitPolls[res.changesWaitUri] = res;
            } else {
                if (res.multiplexWsUri) {
                    var multiplexWebSocketEndpoint = utils.getOrCreateKey(multiplexWebSocketEndpoints, res.multiplexWsUri, { items: [] });
                    multiplexWebSocketEndpoint.items.push(res);
                } else if (res.multiplexWaitUri) {
                    var multiplexWaitEndpoint = utils.getOrCreateKey(multiplexWaitEndpoints, res.multiplexWaitUri, { items: [] });
                    multiplexWaitEndpoint.items.push(res);
                } else {
                    valueWaitEndpoints[res.valueWaitUri] = res;
                }
            }
        });

        var result = {
            valueWaitEndpoints: {},
            multiplexWebSocketEndpoints: {},
            multiplexWaitEndpoints: {},
            changesWaitEndpoints: {}
        };

        utils.forEachOwnKeyValue(multiplexWebSocketEndpoints, function(endpointUri, endpoint) {
            result.multiplexWebSocketEndpoints[endpointUri] = { endpointUri: endpointUri, items: endpoint.items };
        });
        utils.forEachOwnKeyValue(multiplexWaitEndpoints, function(endpointUri, endpoint) {
            if (endpoint.items.length > 1 || !endpoint.items[0].valueWaitUri) {
                result.multiplexWaitEndpoints[endpointUri] = { endpointUri: endpointUri, items: endpoint.items };
            } else {
                valueWaitEndpoints[endpoint.items[0].valueWaitUri] = endpoint.items[0];
            }
        });
        utils.forEachOwnKeyValue(valueWaitEndpoints, function(endpointUri, endpoint) {
            result.valueWaitEndpoints[endpointUri] = { endpointUri: endpointUri, item: endpoint };
        });
        utils.forEachOwnKeyValue(changeWaitPolls, function(endpointUri, endpoint) {
            result.changesWaitEndpoints[endpointUri] = { endpointUri: endpointUri, item: endpoint };
        });

        return result;
    },
    updateValueItem: function(resource, headers, body) {

        utils.forEachOwnKeyValue(headers, function(key, header) {
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

    },
    updateValueItemMultiplex: function(resources, uri, headers, body) {
        utils.forEachOwnKeyValue(resources, function(resourceUri, resource) {
            if (resourceUri == uri) {

                this.updateValueItem(resource, headers, body);

            }
        }, this);
    },
    _createMultiplexWebSocketConnection: function(endpointUri) {
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
                return mapWebSocketUrls.mapWebSocketUrlToHttpUrl(absoluteUri);
            },
            checkSubscriptions: function(items) {

                var endpointUri = this.uri;
                debug.info("Multiplex Ws Request URI: " + endpointUri);

                var subscribedItems = {};
                utils.forEachOwnKeyValue(this.subscribedItems, function(uri, value) {
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

                utils.forEachOwnKeyValue(subscribedItems, function(uri) {
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
                var httpUri = mapWebSocketUrls.mapWebSocketUrlToHttpUrl(absoluteUri);

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
    },
    _createValueWaitConnection: function(endpointUri, item) {
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
    },
    _onFinishedValueWaitRequest: function(poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            this.updateValueItem(poll.res, headers, result);

        }

        this._update();
    },
    _createMultiplexWaitConnection: function(endpointUri, items) {
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
    },
    _onFinishedMultiplexWait: function(poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            utils.forEachOwnKeyValue(result, function (uri, item) {

                debug.info('got data for uri: ' + uri);

                var absoluteUri = utils.toAbsoluteUri(poll.uri, uri);

                this.updateValueItemMultiplex(this._resources, absoluteUri, item.headers, item.body);

            }, this);

        }

        this._update();
    },
    _createChangesWaitConnection: function(endpointUri, item) {
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
    },
    _onFinishedChangesWait: function (poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            utils.forEachOwnKeyValue(headers, function(key, header) {

                var lkey = key.toLowerCase();
                if (lkey == 'link') {
                    var links = parseLinkHeader(header);
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
    },
    _update: function () {
        if (!this._timer) {
            this._timer = utils.nextUpdate(function () {

                this._timer = null;
                var _this = this;

                // restart our long poll
                debug.info('engine: setup long polls');

                var adjustEndpoints = function(label, currentConnectionsMap, preferredEndpointsMap, changeTest, abortConnection, newConnection, refreshConnection) {

                    // currentConnectionsMap = endpointUri -> connection
                    // preferredEndpointsMap = endpointUri -> endpoint

                    // Keep track of list of new endpoints to enable
                    var newEndpoints = {};
                    utils.forEachOwnKeyValue(preferredEndpointsMap, function(endpointUri, endpoint) {
                        newEndpoints[endpointUri] = endpoint;
                    });

                    // Make a list of endpoints to disable...
                    var endpointsToDisable = [];
                    utils.forEachOwnKeyValue(currentConnectionsMap, function(endpointUri, connection) {
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
                    utils.forEachOwnKeyValue(newEndpoints, function(endpointUri, endpoint) {
                        debug.info("Adding '" + label + "' endpoint - '" + endpointUri + "'.");
                        currentConnectionsMap[endpointUri] = newConnection(endpoint);
                    }, this);

                    // For any current endpoint, start them up if
                    // they are not currently marked as being isActive.
                    utils.forEachOwnKeyValue(currentConnectionsMap, function(endpointUri, connection) {
                        var endpoint = preferredEndpointsMap[endpointUri];
                        refreshConnection(connection, endpoint);
                    });
                };

                var preferredEndpoints = this._getPreferredEndpointsForResources(this._resources);

                adjustEndpoints(
                    "Multiplex WS",
                    this._multiplexWebSocketConnections,
                    preferredEndpoints.multiplexWebSocketEndpoints,
                    function(endpoint, connection) {
                        return endpoint.items.length == 0;
                    },
                    function(connection) { connection.socket.abort(); },
                    function(endpoint) { return _this._createMultiplexWebSocketConnection(endpoint.endpointUri); },
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
                            var i;
                            for (i = 0; i < endpoint.items.length; i++) {
                                preferredEndpointItemUris.push(endpoint.items[i].uri);
                            }
                            preferredEndpointItemUris.sort();

                            var pollResourceItemUris = [];
                            for (i = 0; i < connection.resItems.length; i++) {
                                pollResourceItemUris.push(connection.resItems[i].uri);
                            }
                            pollResourceItemUris.sort();

                            for (i = 0; i < preferredEndpointItemUris.length; i++) {
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
    },
    _getOrCreateResource: function (uri) {
        if (!(uri in this._resources)) {
            this._resources[uri] = {
                uri: uri,
                owners: []
            };
        }
        return this._resources[uri];
    },
    addObjectResource: function (resourceHandler) {
        var res = this._getOrCreateResource(resourceHandler.uri);
        res.owners.push(resourceHandler);
        res.etag = resourceHandler.valueAspect.etag;
        res.valueWaitUri = resourceHandler.valueAspect.valueWaitUri;
        res.multiplexWaitUri = resourceHandler.valueAspect.multiplexWaitUri;
        res.multiplexWsUri = resourceHandler.valueAspect.multiplexWsUri;
        this._update();
    },
    addCollectionResource: function (resourceHandler) {
        var res = this._getOrCreateResource(resourceHandler.uri);
        res.owners.push(resourceHandler);
        res.changesWaitUri = resourceHandler.changesAspect.changesWaitUri;
        this._update();
    }
});

utils.extend(Engine, {
    _engine: null,
    getSharedEngine: function() {
        if (this._engine == null) {
            this._engine = new Engine();
        }
        return this._engine;
    }
});

module.exports = Engine;