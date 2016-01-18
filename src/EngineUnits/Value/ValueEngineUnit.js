import { getOrCreateEntry, toAbsoluteUri } from 'utils';
import { mapHttpUrlToWebSocketUrl } from 'utils.mapWebSocketUrls';
import { parseLinkHeader } from 'utils.parseLinkHeader';

import EngineUnit from 'Framework/EngineUnit';
import ValueResourcePart from 'EngineUnits/Value/ValueResourcePart';
import ValueWaitConnection from 'EngineUnits/Value/ValueWaitConnection';
import MultiplexWebSocketConnection from 'EngineUnits/Value/MultiplexWebSocketConnection';
import MultiplexWaitConnection from 'EngineUnits/Value/MultiplexWaitConnection';

class ValueEngineUnit extends EngineUnit {
    constructor() {
        super();

        this._valueWaitConnections = [];
        this._multiplexWebSocketConnections = [];
        this._multiplexWaitConnections = [];
    }

    updateEndpointsToResourceParts(parts) {

        const valueWaitItems = new Map();
        const multiplexWebSocketItems = new Map();
        const multiplexWaitItems = new Map();
        parts.forEach(part => {
            if (MultiplexWebSocketConnection.isWebSockHopAvailable && part.linkUris['MULTIPLEX_WS'] != null) {
                var multiplexWebSocketPoll = getOrCreateEntry(multiplexWebSocketItems, part.linkUris['MULTIPLEX_WS'], () => ({items: []}));
                multiplexWebSocketPoll.items.push(part);
            } else if (part.linkUris['MULTIPLEX_WAIT'] != null) {
                var multiplexWaitPoll = getOrCreateEntry(multiplexWaitItems, part.linkUris['MULTIPLEX_WAIT'], () => ({items: []}));
                multiplexWaitPoll.items.push(part);
            } else {
                valueWaitItems.set(part.linkUris['VALUE_WAIT'], part);
            }
        });

        const valueWaitEndpoints = new Map();
        const multiplexWebSocketEndpoints = new Map();
        const multiplexWaitEndpoints = new Map();
        multiplexWebSocketItems.forEach((endpoint, endpointUri) => {
            multiplexWebSocketEndpoints.set(endpointUri, { endpointUri, items: endpoint.items });
        });
        multiplexWaitItems.forEach((endpoint, endpointUri) => {
            if (endpoint.items.length > 1 || !endpoint.items[0].linkUris['VALUE_WAIT']) {
                multiplexWaitEndpoints.set(endpointUri, { endpointUri, items: endpoint.items });
            } else {
                valueWaitItems.set(endpoint.items[0].linkUris['VALUE_WAIT'], endpoint.items[0]);
            }
        });
        valueWaitItems.forEach((endpoint, endpointUri) => {
            valueWaitEndpoints.set(endpointUri, { endpointUri, item: endpoint });
        });

        this.updateConnectionsToMatchEndpoints(
            'Value Wait',
            this._valueWaitConnections,
            valueWaitEndpoints,
            endpoint => new ValueWaitConnection(this, endpoint)
        );
        this.updateConnectionsToMatchEndpoints(
            'Multiplex Web Socket',
            this._multiplexWebSocketConnections,
            multiplexWebSocketEndpoints,
            endpoint => new MultiplexWebSocketConnection(this, endpoint)
        );
        this.updateConnectionsToMatchEndpoints(
            'Multiplex Wait',
            this._multiplexWaitConnections,
            multiplexWaitEndpoints,
            endpoint => new MultiplexWaitConnection(this, endpoint)
        );

    }

    createResourcePart(resourceHandler) {
        const resource = new ValueResourcePart(resourceHandler);

        let request = this.createLongPoll();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 400) {
                // 304 if not changed, don't trigger value
                this.updateResourcePart(resource, headers, code < 300 ? result : null);

                if (!resource.etag) {
                    console.info('no etag');
                }
                this.updateEngine();
                request = null;
            } else if (code >= 400) {
                if (code == 404) {
                    resourceHandler.trigger('removed', resourceHandler);
                    request = null;
                } else {
                    request.retry();
                }
            }
        });
        request.start('GET', resourceHandler.uri);

        return resource;
    }

    get interestType() {
        return 'value';
    }

    get events() {
        return ['value', 'removed'];
    }

    updateResourcePart(resourcePart, headers, result) {

        const parsedHeaders = ValueEngineUnit.parseHeaders(headers, resourcePart.resourceHandler.uri);
        if (parsedHeaders.etag) {
            resourcePart.etag = parsedHeaders.etag;
        }
        if (parsedHeaders.valueWaitUri) {
            resourcePart.linkUris['VALUE_WAIT'] = parsedHeaders.valueWaitUri;
        }
        if (parsedHeaders.multiplexWaitUri) {
            resourcePart.linkUris['MULTIPLEX_WAIT'] = parsedHeaders.multiplexWaitUri;
        }
        if (parsedHeaders.multiplexWsUri) {
            resourcePart.linkUris['MULTIPLEX_WS'] = parsedHeaders.multiplexWsUri;
        }

        super.updateResourcePart(resourcePart, headers, result);
    }

    triggerEvents(part, result) {
        if (result != undefined) {
            part.resourceHandler.trigger('value', part.resourceHandler, result);
        }
    }

    static parseHeaders(headers, baseUri) {
        let etag = null;
        let valueWaitUri = null;
        let multiplexWaitUri = null;
        let multiplexWsUri = null;

        Object.keys(headers).forEach(key => {
            const header = headers[key];

            var k = key.toLowerCase();
            if (k == 'etag') {
                etag = header;
            } else if (k == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['value-wait']) {
                    valueWaitUri = toAbsoluteUri(baseUri, links['value-wait']['href']);
                }
                if (links && links['multiplex-wait']) {
                    multiplexWaitUri = toAbsoluteUri(baseUri, links['multiplex-wait']['href']);
                }
                if (links && links['multiplex-ws']) {
                    multiplexWsUri = mapHttpUrlToWebSocketUrl(toAbsoluteUri(baseUri, links['multiplex-ws']['href']));
                }
            }
        });

        const result = {};

        if (etag) {
            console.info('etag: [' + etag + ']');
            result.etag = etag;
        }

        if (valueWaitUri) {
            console.info('value-wait: [' + valueWaitUri + ']');
            result.valueWaitUri = valueWaitUri;
        }

        if (multiplexWaitUri) {
            console.info('multiplex-wait: [' + multiplexWaitUri + ']');
            result.multiplexWaitUri = multiplexWaitUri;
        }

        if (multiplexWsUri) {
            console.info('multiplex-ws: [' + multiplexWsUri + ']');
            result.multiplexWsUri = multiplexWsUri;
        }

        return result;
    }
}

export default ValueEngineUnit;