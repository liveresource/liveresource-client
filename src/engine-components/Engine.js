var utils = require('utils');
var debug = require('console');
var mapWebSocketUrls = require('utils.mapWebSocketUrls');

class Engine {
    constructor() {
        this._resources = {};
        this._updatePending = false;
        this._multiplexWebSocketConnections = {};
        this._multiplexWaitConnections = {};
        this._valueWaitConnections = {};
        this._changesWaitConnections = {};
    }

    _getPreferredEndpointsForResources(resources) {
        var valueWaitEndpoints = {};
        var multiplexWebSocketEndpoints = {};
        var multiplexWaitEndpoints = {};
        var changeWaitPolls = {};

        utils.forEachOwnKeyValue(resources, (resUri, res) => {
            if (res.changesWaitUri) {
                changeWaitPolls[res.changesWaitUri] = res;
            } else {
                if (res.multiplexWsUri) {
                    var multiplexWebSocketEndpoint = utils.getOrCreateKey(multiplexWebSocketEndpoints, res.multiplexWsUri, {items: []});
                    multiplexWebSocketEndpoint.items.push(res);
                } else if (res.multiplexWaitUri) {
                    var multiplexWaitEndpoint = utils.getOrCreateKey(multiplexWaitEndpoints, res.multiplexWaitUri, {items: []});
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

        utils.forEachOwnKeyValue(multiplexWebSocketEndpoints, (endpointUri, endpoint) => {
            result.multiplexWebSocketEndpoints[endpointUri] = {endpointUri: endpointUri, items: endpoint.items};
        });
        utils.forEachOwnKeyValue(multiplexWaitEndpoints, (endpointUri, endpoint) => {
            if (endpoint.items.length > 1 || !endpoint.items[0].valueWaitUri) {
                result.multiplexWaitEndpoints[endpointUri] = {endpointUri: endpointUri, items: endpoint.items};
            } else {
                valueWaitEndpoints[endpoint.items[0].valueWaitUri] = endpoint.items[0];
            }
        });
        utils.forEachOwnKeyValue(valueWaitEndpoints, (endpointUri, endpoint) => {
            result.valueWaitEndpoints[endpointUri] = {endpointUri: endpointUri, item: endpoint};
        });
        utils.forEachOwnKeyValue(changeWaitPolls, (endpointUri, endpoint) => {
            result.changesWaitEndpoints[endpointUri] = {endpointUri: endpointUri, item: endpoint};
        });

        return result;
    }

    updateValueItem(resource, headers, body) {

        utils.forEachOwnKeyValue(headers, (key, header) => {
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

    }

    updateValueItemMultiplex(resources, uri, headers, body) {
        utils.forEachOwnKeyValue(resources, (resourceUri, resource) => {
            if (resourceUri == uri) {

                this.updateValueItem(resource, headers, body);

            }
        });
    }

    _createMultiplexWebSocketConnection(endpointUri) {

        var connection = {
            uri: endpointUri,
            socket: new WebSockHop(endpointUri),
            subscribedItems: {},
            isConnected: false,
            isRetrying: false,
            subscribe: function (uri) {
                var type = 'subscribe', mode = 'value';
                this.socket.request({type, mode, uri}, result => {
                    if (result.type == 'subscribed') {
                        connection.subscribedItems[uri] = uri;
                    }
                });
            },
            unsubscribe: function (uri) {
                var type = 'unsubscribe', mode = 'value';
                this.socket.request({type, mode, uri}, result => {
                    if (result.type == 'unsubscribed') {
                        delete connection.subscribedItems[uri];
                    }
                })
            },
            mapToHttpUri: function (uri) {
                var absoluteUri = utils.toAbsoluteUri(this.uri, uri);
                return mapWebSocketUrls.mapWebSocketUrlToHttpUrl(absoluteUri);
            },
            checkSubscriptions: function (items) {

                var endpointUri = this.uri;
                debug.info("Multiplex Ws Request URI: " + endpointUri);

                var subscribedItems = {};
                utils.forEachOwnKeyValue(this.subscribedItems, (uri, value) => {
                    subscribedItems[uri] = value;
                });

                for (var i = 0; i < items.length; i++) {
                    var httpUri = this.mapToHttpUri(items[i].uri);
                    if (httpUri in subscribedItems) {
                        delete subscribedItems[httpUri];
                    } else {
                        this.subscribe(httpUri);
                    }
                }

                utils.forEachOwnKeyValue(subscribedItems, uri => {
                    this.unsubscribe(uri);
                });

            },
            close: function () {
                if (this.isConnected) {
                    this.socket.close();
                } else {
                    this.socket.abort();
                }
            }
        };

        connection.socket.formatter = new WebSockHop.JsonFormatter();

        connection.socket.on("opened", () => {
            connection.socket.on("message", data => {

                var uri = data.uri;
                var absoluteUri = utils.toAbsoluteUri(endpointUri, uri);
                var httpUri = mapWebSocketUrls.mapWebSocketUrlToHttpUrl(absoluteUri);

                this.updateValueItemMultiplex(this._resources, httpUri, data.headers, data.body);

            });
            connection.subscribedItems = {};
            connection.isConnected = true;
            connection.isRetrying = false;

            this._update();
        });

        connection.socket.on("closed", () => {
            connection.isConnected = false;
            connection.isRetrying = false;
        });

        connection.socket.on("error", () => {
            connection.isConnected = false;
            connection.isRetrying = true;
        });

        return connection;
    }

    _createValueWaitConnection(endpointUri, item) {
        var poll = {
            uri: endpointUri,
            request: new Pollymer.Request(),
            res: item,
            isActive: false
        };
        poll.request.on("finished", (code, result, headers) => {
            poll.isActive = false;
            this._onFinishedValueWaitRequest(poll, code, result, headers);
        });
        return poll;
    }

    _onFinishedValueWaitRequest(poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            this.updateValueItem(poll.res, headers, result);

        }

        this._update();
    }

    _createMultiplexWaitConnection(endpointUri, items) {
        var poll = {
            uri: endpointUri,
            request: new Pollymer.Request(),
            resItems: items,
            isActive: false
        };
        poll.request.on("finished", (code, result, headers) => {
            poll.isActive = false;
            this._onFinishedMultiplexWait(poll, code, result, headers);
        });
        return poll;
    }

    _onFinishedMultiplexWait(poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            utils.forEachOwnKeyValue(result, (uri, item) => {

                debug.info('got data for uri: ' + uri);

                var absoluteUri = utils.toAbsoluteUri(poll.uri, uri);

                this.updateValueItemMultiplex(this._resources, absoluteUri, item.headers, item.body);

            });

        }

        this._update();
    }

    _createChangesWaitConnection(endpointUri, item) {
        var poll = {
            uri: endpointUri,
            request: new Pollymer.Request(),
            res: item,
            isActive: false
        };
        poll.request.on("finished", (code, result, headers) => {
            poll.isActive = false;
            this._onFinishedChangesWait(poll, code, result, headers);
        });
        return poll;
    }

    _onFinishedChangesWait(poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            utils.forEachOwnKeyValue(headers, (key, header) => {

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
    }

    static adjustEndpoints(label, currentConnectionsMap, preferredEndpointsMap, changeTest, abortConnection, newConnection, refreshConnection) {

        // currentConnectionsMap = endpointUri -> connection
        // preferredEndpointsMap = endpointUri -> endpoint

        // Keep track of list of new endpoints to enable
        var newEndpoints = {};
        utils.forEachOwnKeyValue(preferredEndpointsMap, (endpointUri, endpoint) => {
            newEndpoints[endpointUri] = endpoint;
        });

        // Make a list of endpoints to disable...
        var endpointsToDisable = [];
        utils.forEachOwnKeyValue(currentConnectionsMap, (endpointUri, connection) => {
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
        utils.forEachOwnKeyValue(newEndpoints, (endpointUri, endpoint) => {
            debug.info("Adding '" + label + "' endpoint - '" + endpointUri + "'.");
            currentConnectionsMap[endpointUri] = newConnection(endpoint);
        });

        // For any current endpoint, start them up if
        // they are not currently marked as being isActive.
        utils.forEachOwnKeyValue(currentConnectionsMap, (endpointUri, connection) => {
            var endpoint = preferredEndpointsMap[endpointUri];
            refreshConnection(connection, endpoint);
        });
    }

    _update() {
        if (!this._updatePending) {
            this._updatePending = true;
            process.nextTick(() => {
                this._updatePending = false;

                // restart our long poll
                debug.info('engine: setup long polls');

                var preferredEndpoints = this._getPreferredEndpointsForResources(this._resources);

                Engine.adjustEndpoints(
                    "Multiplex WS",
                    this._multiplexWebSocketConnections,
                    preferredEndpoints.multiplexWebSocketEndpoints,
                    (endpoint, connection) => endpoint.items.length == 0,
                    connection => { connection.socket.abort(); },
                    endpoint => this._createMultiplexWebSocketConnection(endpoint.endpointUri),
                    (connection, endpoint) => {
                        if (connection.isConnected) {
                            connection.checkSubscriptions(endpoint.items);
                        }
                    }
                );

                Engine.adjustEndpoints(
                    "Value Wait",
                    this._valueWaitConnections,
                    preferredEndpoints.valueWaitEndpoints,
                    (endpoint, connection) => endpoint.item.uri != connection.res.uri,
                    connection => { connection.request.abort(); },
                    endpoint => this._createValueWaitConnection(endpoint.endpointUri, endpoint.item),
                    (connection, endpoint) => {
                        if (!connection.isActive) {
                            var requestUri = connection.uri;
                            debug.info("Value Wait Request URI: " + requestUri);
                            connection.request.start('GET', requestUri, {
                                'If-None-Match': connection.res.etag,
                                'Wait': 55
                            });
                            connection.isActive = true;
                        }
                    }
                );

                Engine.adjustEndpoints(
                    "Multiplex Wait",
                    this._multiplexWaitConnections,
                    preferredEndpoints.multiplexWaitEndpoints,
                    (endpoint, connection) => {
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
                    connection => { connection.request.abort(); },
                    endpoint => this._createMultiplexWaitConnection(endpoint.endpointUri, endpoint.items.slice()),
                    (connection, endpoint) => {
                        if (!connection.isActive) {
                            var urlSegments = [];
                            for (var i = 0; i < connection.resItems.length; i++) {
                                var res = connection.resItems[i];
                                var uri = res.uri;
                                urlSegments.push('u=' + encodeURIComponent(uri) + '&inm=' + encodeURIComponent(res.etag));
                            }
                            var requestUri = connection.uri + '?' + urlSegments.join('&');

                            debug.info("Multiplex Wait Request URI: " + requestUri);
                            connection.request.start('GET', requestUri, {'Wait': 55});
                            connection.isActive = true;
                        }
                    }
                );

                Engine.adjustEndpoints(
                    "Changes Wait",
                    this._changesWaitConnections,
                    preferredEndpoints.changesWaitEndpoints,
                    (endpoint, connection) => endpoint.item.uri != connection.res.uri,
                    connection => { connection.request.abort(); },
                    endpoint => this._createChangesWaitConnection(endpoint.endpointUri, endpoint.item),
                    (connection, endpoint) => {
                        if (!connection.isActive) {
                            var requestUri = connection.uri;
                            debug.info("Changes Wait Request URI: " + requestUri);
                            connection.request.start('GET', requestUri, {'Wait': 55});
                            connection.isActive = true;
                        }
                    }
                );

            });
        }
    }

    _getOrCreateResource(uri) {
        if (!(uri in this._resources)) {
            this._resources[uri] = {
                uri: uri,
                owners: []
            };
        }
        return this._resources[uri];
    }

    addObjectResource(resourceHandler) {
        var res = this._getOrCreateResource(resourceHandler.uri);
        res.owners.push(resourceHandler);
        res.etag = resourceHandler.valueAspect.etag;
        res.valueWaitUri = resourceHandler.valueAspect.valueWaitUri;
        res.multiplexWaitUri = resourceHandler.valueAspect.multiplexWaitUri;
        res.multiplexWsUri = resourceHandler.valueAspect.multiplexWsUri;
        this._update();
    }

    addCollectionResource(resourceHandler) {
        var res = this._getOrCreateResource(resourceHandler.uri);
        res.owners.push(resourceHandler);
        res.changesWaitUri = resourceHandler.changesAspect.changesWaitUri;
        this._update();
    }
}

// We only export the "getSharedEngine" function here

var _engine = null;
var getSharedEngine = function() {
    if (_engine == null) {
        _engine = new Engine();
    }
    return _engine;
};

module.exports = getSharedEngine;