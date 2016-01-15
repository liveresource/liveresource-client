import { getOrCreateEntry, toAbsoluteUri } from 'utils';
import { mapHttpUrlToWebSocketUrl } from 'utils.mapWebSocketUrls';
import { parseLinkHeader } from 'utils.parseLinkHeader';

import EngineUnitBase from 'EngineUnits/EngineUnitBase';
import ValueResource from 'EngineUnits/Value/ValueResource';
import ValueWaitConnection from 'EngineUnits/Value/ValueWaitConnection';
import MultiplexWebSocketConnection from 'EngineUnits/Value/MultiplexWebSocketConnection';
import MultiplexWaitConnection from 'EngineUnits/Value/MultiplexWaitConnection';

class ValueEngineUnit extends EngineUnitBase {
    constructor() {
        super();

        this._valueWaitConnections = new Map();
        this._multiplexWebSocketConnections = new Map();
        this._multiplexWaitConnections = new Map();
    }

    update() {

        const resourceAspects = this.engine.getResourceAspectsForInterestType(this.interestType);

        const valueWaitItems = new Map();
        const multiplexWebSocketItems = new Map();
        const multiplexWaitItems = new Map();

        for (let res of resourceAspects) {
            if (MultiplexWebSocketConnection.isWebSockHopAvailable && res.multiplexWebSocketUri) {
                var multiplexWebSocketPoll = getOrCreateEntry(multiplexWebSocketItems, res.multiplexWebSocketUri, () => ({items: []}));
                multiplexWebSocketPoll.items.push(res);
            } else if (res.multiplexWaitUri) {
                var multiplexWaitPoll = getOrCreateEntry(multiplexWaitItems, res.multiplexWaitUri, () => ({items: []}));
                multiplexWaitPoll.items.push(res);
            } else {
                valueWaitItems.set(res.valueWaitUri, res);
            }
        }

        const valueWaitEndpoints = new Map();
        const multiplexWebSocketEndpoints = new Map();
        const multiplexWaitEndpoints = new Map();
        for (let [endpointUri, endpoint] of multiplexWebSocketItems) {
            multiplexWebSocketEndpoints.set(endpointUri, { endpointUri, items: endpoint.items });
        }
        for (let [endpointUri, endpoint] of multiplexWaitItems) {
            if (endpoint.items.length > 1 || !endpoint.items[0].valueWaitUri) {
                multiplexWaitEndpoints.set(endpointUri, { endpointUri, items: endpoint.items });
            } else {
                valueWaitItems.set(endpoint.items[0].valueWaitUri, endpoint.items[0]);
            }
        }
        for (let [endpointUri, endpoint] of valueWaitItems) {
            valueWaitEndpoints.set(endpointUri, { endpointUri, item: endpoint });
        }

        this._adjustEndpoints(
            'Value Wait',
            this._valueWaitConnections,
            valueWaitEndpoints,
            endpoint => new ValueWaitConnection(this, endpoint)
        );
        this._adjustEndpoints(
            'Multiplex Web Socket',
            this._multiplexWebSocketConnections,
            multiplexWebSocketEndpoints,
            endpoint => new MultiplexWebSocketConnection(this, endpoint)
        );
        this._adjustEndpoints(
            'Multiplex Wait',
            this._multiplexWaitConnections,
            multiplexWaitEndpoints,
            endpoint => new MultiplexWaitConnection(this, endpoint)
        );

    }

    start(resourceHandler) {
        const resource = new ValueResource(resourceHandler);

        let request = this.createLongPoll();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 400) {
                // 304 if not changed, don't trigger value
                this.updateResource(resource, headers, code < 300 ? result : null);

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

    updateResource(resource, headers, result) {

        const parsedHeaders = ValueEngineUnit.parseHeaders(headers, resource.resourceHandler.uri);
        if (parsedHeaders.etag) {
            resource.etag = parsedHeaders.etag;
        }
        if (parsedHeaders.valueWaitUri) {
            resource.valueWaitUri = parsedHeaders.valueWaitUri;
        }
        if (parsedHeaders.multiplexWaitUri) {
            resource.multiplexWaitUri = parsedHeaders.multiplexWaitUri;
        }
        if (parsedHeaders.multiplexWsUri) {
            resource.multiplexWebSocketUri = parsedHeaders.multiplexWsUri;
        }

        super.updateResource(resource, headers, result);
    }

    triggerEvents(resource, result) {
        if (result != undefined) {
            resource.resourceHandler.trigger('value', resource.resourceHandler, result);
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