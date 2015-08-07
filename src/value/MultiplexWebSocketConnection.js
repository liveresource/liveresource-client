var utils = require('utils');
var debug = require('console');
var mapWebSocketUrls = require('utils.mapWebSocketUrls');
var WebSockHop = require('WebSockHop');

var Connection = require('engine-components/Connection');
var ValueResource = require('value/ValueResource');

class MultiplexWebSocketConnection extends Connection {
    constructor(engine, endpoint, engineUnit) {
        super(engine);

        var endpointUri = endpoint.endpointUri;

        this.uri = endpointUri;
        this.socket = new WebSockHop(endpointUri);
        this.subscribedItems = {};
        this.isConnected = false;
        this.isRetrying = false;

        this.socket.formatter = new WebSockHop.JsonFormatter();

        this.socket.on("opened", () => {
            this.socket.on("message", data => {

                var uri = data.uri;
                var absoluteUri = utils.toAbsoluteUri(endpointUri, uri);
                var httpUri = mapWebSocketUrls.mapWebSocketUrlToHttpUrl(absoluteUri);

                ValueResource.updateValueItemMultiplex(engineUnit._resources, httpUri, data.headers, data.body);

            });
            this.subscribedItems = {};
            this.isConnected = true;
            this.isRetrying = false;

            this._engine.update();
        });

        this.socket.on("closed", () => {
            this.isConnected = false;
            this.isRetrying = false;
        });

        this.socket.on("error", () => {
            this.isConnected = false;
            this.isRetrying = true;
        });
    }

    subscribe(uri) {
        var type = 'subscribe', mode = 'value';
        this.socket.request({type, mode, uri}, result => {
            if (result.type == 'subscribed') {
                connection.subscribedItems[uri] = uri;
            }
        });
    }

    unsubscribe(uri) {
        var type = 'unsubscribe', mode = 'value';
        this.socket.request({type, mode, uri}, result => {
            if (result.type == 'unsubscribed') {
                delete connection.subscribedItems[uri];
            }
        })
    }

    mapToHttpUri(uri) {
        var absoluteUri = utils.toAbsoluteUri(this.uri, uri);
        return mapWebSocketUrls.mapWebSocketUrlToHttpUrl(absoluteUri);
    }

    checkSubscriptions(items) {

        var endpointUri = this.uri;
        debug.info(`Multiplex WebSocket Request URI: ${endpointUri}`);

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

    }

    close() {
        if (this.isConnected) {
            this.socket.close();
        } else {
            this.socket.abort();
        }
    }

    hasChanged(endpoint) {
        return endpoint.items.length == 0;
    }

    abort() {
        this.socket.abort();
    }

    refresh(endpoint) {
        if (this.isConnected) {
            this.checkSubscriptions(endpoint.items);
        }
    }
}

module.exports = MultiplexWebSocketConnection;