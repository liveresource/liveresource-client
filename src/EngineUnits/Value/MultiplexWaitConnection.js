import { toAbsoluteUri } from 'utils';

import Connection from 'Framework/Connection';
import ValueResource from 'EngineUnits/Value/ValueResourcePart';

class MultiplexWaitConnection extends Connection {
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
                    var absoluteUri = toAbsoluteUri(this.uri, uri);
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

            // At this point we know the two arrays are the same length.
            // Sort them and then compare their contents one by one.

            const preferredEndpointItemUris = [];
            endpoint.items.forEach(item => {
                preferredEndpointItemUris.push(item.resourceHandler.uri);
            });
            preferredEndpointItemUris.sort();

            const pollResourceItemUris = [];
            this.resItems.forEach(resItem => {
                pollResourceItemUris.push(resItem.resourceHandler.uri);
            });
            pollResourceItemUris.sort();

            for (let i = 0; i < preferredEndpointItemUris.length; i++) {
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
            this.resItems.forEach(res => {
                var uri = res.resourceHandler.uri;
                urlSegments.push(`u=${encodeURIComponent(uri)}&inm=${encodeURIComponent(res.etag)}`);
            });

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