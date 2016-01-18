import { toAbsoluteUri } from 'utils';
import { mapWebSocketUrlToHttpUrl } from 'utils.mapWebSocketUrls';
import WebSockHop from 'WebSockHop';

import Connection from 'Framework/Connection';
import ValueResource from 'EngineUnits/Value/ValueResourcePart';

class MultiplexWebSocketConnection extends Connection {
    constructor(engineUnit, endpoint) {
        super(engineUnit);

        const endpointUri = endpoint.endpointUri;

        this.uri = endpointUri;
        this.socket = new WebSockHop(endpointUri);
        this.subscribedItems = {};
        this.isConnected = false;
        this.isRetrying = false;

        this.socket.formatter = new WebSockHop.JsonFormatter();

        this.socket.on("opened", () => {
            this.socket.on("message", data => {

                var uri = data.uri;
                var absoluteUri = toAbsoluteUri(endpointUri, uri);
                var httpUri = mapWebSocketUrlToHttpUrl(absoluteUri);

                engineUnit.updateResources(httpUri, data.headers, data.body);

            });
            this.subscribedItems = {};
            this.isConnected = true;
            this.isRetrying = false;

            this._engineUnit.updateEngine();
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
                this.subscribedItems[uri] = uri;
            }
        });
    }

    unsubscribe(uri) {
        var type = 'unsubscribe', mode = 'value';
        this.socket.request({type, mode, uri}, result => {
            if (result.type == 'unsubscribed') {
                delete this.subscribedItems[uri];
            }
        })
    }

    mapToHttpUri(uri) {
        var absoluteUri = toAbsoluteUri(this.uri, uri);
        return mapWebSocketUrlToHttpUrl(absoluteUri);
    }

    checkSubscriptions(items) {

        const endpointUri = this.uri;
        console.info(`Multiplex WebSocket Request URI: ${endpointUri}`);

        const subscribedItems = Object.assign({}, this.subscribedItems);

        items.length.forEach(item => {
            var httpUri = this.mapToHttpUri(item.resourceHandler.uri);
            if (httpUri in subscribedItems) {
                delete subscribedItems[httpUri];
            } else {
                this.subscribe(httpUri);
            }
        });

        Object.keys(subscribedItems).forEach(uri => this.unsubscribe(uri));

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

    static get isWebSockHopAvailable() {
        return WebSockHop.isAvailable();
    }
}

export default MultiplexWebSocketConnection;