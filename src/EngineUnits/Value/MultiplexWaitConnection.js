var utils = require('utils');

import ValueResource from 'EngineUnits/Value/ValueResource';
import ConnectionBase from 'EngineUnits/ConnectionBase';

class MultiplexWaitConnection extends ConnectionBase {
    constructor(engineUnit, endpoint) {
        super(engineUnit);

        this.uri = endpoint.endpointUri;
        this.request = engineUnit.createLongPoll();
        this.resItems = endpoint.items.slice();
        this.isActive = false;

        this.request.on("finished", (code, result, headers) => {
            this.isActive = false;

            if (code >= 200 && code < 300) {

                Object.keys(result).forEach(uri => {
                    const item = result[uri];
                    console.info(`got data for uri: ${uri}`);
                    var absoluteUri = utils.toAbsoluteUri(this.uri, uri);
                    engineUnit.updateResources(absoluteUri, item.headers, item.body);
                });

            }

            this._engineUnit.updateEngine();
        });
    }

    hasChanged(endpoint) {
        let removedOrChanged = false;
        if (endpoint.items.length != this.resItems.length) {
            removedOrChanged = true
        } else {
            const preferredEndpointItemUris = [];
            var i;
            for (i = 0; i < endpoint.items.length; i++) {
                preferredEndpointItemUris.push(endpoint.items[i].resourceHandler.uri);
            }
            preferredEndpointItemUris.sort();

            const pollResourceItemUris = [];
            for (i = 0; i < this.resItems.length; i++) {
                pollResourceItemUris.push(this.resItems[i].resourceHandler.uri);
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
    }

    abort() {
        this.request.abort();
    }

    refresh(endpoint) {
        if (!this.isActive) {
            const urlSegments = [];
            for (var i = 0; i < this.resItems.length; i++) {
                var res = this.resItems[i];
                var uri = res.resourceHandler.uri;
                urlSegments.push(`u=${encodeURIComponent(uri)}&inm=${encodeURIComponent(res.etag)}`);
            }

            const requestUri = `${this.uri}?${urlSegments.join('&')}`;
            console.info(`Multiplex Wait Request URI: ${requestUri}`);
            this._engineUnit.setLongPollOptions(this.request);
            this.request.start('GET', requestUri, {
                'Wait': 55
            });
            this.isActive = true;
        }
    }
}

export default MultiplexWaitConnection;