import { getOrCreateEntry, toAbsoluteUri } from '../../utils';
import { mapHttpUrlToWebSocketUrl } from '../../utils.mapWebSocketUrls';
import { parseLinkHeader } from '../../utils.parseLinkHeader';
import * as Logger from "../../Logger";

import EngineUnit from '../../Framework/EngineUnit';
import ValueResourcePart from './ValueResourcePart';
import ValueWaitConnection from './ValueWaitConnection';
import MultiplexWebSocketConnection from './MultiplexWebSocketConnection';
import MultiplexWaitConnection from './MultiplexWaitConnection';

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
                    Logger.info('no etag');
                }
                this.updateEngine();
                request = null;
            } else if (code >= 400) {
                if (code == 404) {
                    resourceHandler.forEachLiveResource(liveResource => liveResource.trigger('removed', liveResource));
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

        this.updateConnection(resourcePart, this._valueWaitConnections, 'VALUE_WAIT', parsedHeaders.valueWaitUri);
        this.updateConnection(resourcePart, this._multiplexWaitConnections, 'MULTIPLEX_WAIT', parsedHeaders.multiplexWaitUri);
        this.updateConnection(resourcePart, this._multiplexWebSocketConnections, 'MULTIPLEX_WS', parsedHeaders.multiplexWsUri);

        super.updateResourcePart(resourcePart, headers, result);
    }

    triggerEvents(part, headers, result) {
        if (result) {
            part.resourceHandler.forEachLiveResource(liveResource => {
                // TODO: ContentType
                var parsed = liveResource.parse(this.interestType, headers, result);
                liveResource.trigger('value', liveResource, parsed);
            });
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
            Logger.info('etag: [' + etag + ']');
            result.etag = etag;
        }

        if (valueWaitUri) {
            Logger.info('value-wait: [' + valueWaitUri + ']');
            result.valueWaitUri = valueWaitUri;
        }

        if (multiplexWaitUri) {
            Logger.info('multiplex-wait: [' + multiplexWaitUri + ']');
            result.multiplexWaitUri = multiplexWaitUri;
        }

        if (multiplexWsUri) {
            Logger.info('multiplex-ws: [' + multiplexWsUri + ']');
            result.multiplexWsUri = multiplexWsUri;
        }

        return result;
    }

    defaultParser(headers, data) {
        return JSON.parse(data);
    }
}

export default ValueEngineUnit;