var utils = require('utils');
var debug = require('console');
var mapWebSocketUrls = require('utils.mapWebSocketUrls');
var parseLinkHeader = require('utils.parseLinkHeader');

var EngineUnitBase = require('EngineUnits/EngineUnitBase');
var ValueResource = require('EngineUnits/Value/ValueResource');
var ValueWaitConnection = require('EngineUnits/Value/ValueWaitConnection');
var MultiplexWebSocketConnection = require('EngineUnits/Value/MultiplexWebSocketConnection');
var MultiplexWaitConnection = require('EngineUnits/Value/MultiplexWaitConnection');

class ValueEngineUnit extends EngineUnitBase {
    constructor() {
        super();

        this._valueWaitConnections = new Map();
        this._multiplexWebSocketConnections = new Map();
        this._multiplexWaitConnections = new Map();
    }

    update() {

        var resourceAspects = this.engine.getResourceAspectsForInterestType(this.interestType);

        var valueWaitItems = new Map();
        var multiplexWebSocketItems = new Map();
        var multiplexWaitItems = new Map();

        for (let res of resourceAspects) {
            if (MultiplexWebSocketConnection.isWebSockHopAvailable && res.multiplexWebSocketUri) {
                var multiplexWebSocketPoll = multiplexWebSocketItems.getOrCreate(res.multiplexWebSocketUri, () => ({items: []}));
                multiplexWebSocketPoll.items.push(res);
            } else if (res.multiplexWaitUri) {
                var multiplexWaitPoll = multiplexWaitItems.getOrCreate(res.multiplexWaitUri, () => ({items: []}));
                multiplexWaitPoll.items.push(res);
            } else {
                valueWaitItems.set(res.valueWaitUri, res);
            }
        }

        var valueWaitEndpoints = new Map();
        var multiplexWebSocketEndpoints = new Map();
        var multiplexWaitEndpoints = new Map();
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
        var resource = new ValueResource(resourceHandler);

        var request = this.createLongPoll();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 400) {
                // 304 if not changed, don't trigger value
                this.updateResource(resource, headers, code < 300 ? result : null);

                if (!resource.etag) {
                    debug.info('no etag');
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

        var parsedHeaders = ValueEngineUnit.parseHeaders(headers, resource.resourceHandler.uri);
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
        var etag = null;
        var valueWaitUri = null;
        var multiplexWaitUri = null;
        var multiplexWsUri = null;

        utils.forEachOwnKeyValue(headers, (key, header) => {

            var k = key.toLowerCase();
            if (k == 'etag') {
                etag = header;
            } else if (k == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['value-wait']) {
                    valueWaitUri = utils.toAbsoluteUri(baseUri, links['value-wait']['href']);
                }
                if (links && links['multiplex-wait']) {
                    multiplexWaitUri = utils.toAbsoluteUri(baseUri, links['multiplex-wait']['href']);
                }
                if (links && links['multiplex-ws']) {
                    multiplexWsUri = mapWebSocketUrls.mapHttpUrlToWebSocketUrl(utils.toAbsoluteUri(baseUri, links['multiplex-ws']['href']));
                }
            }

        });

        var result = {};

        if (etag) {
            debug.info('etag: [' + etag + ']');
            result.etag = etag;
        }

        if (valueWaitUri) {
            debug.info('value-wait: [' + valueWaitUri + ']');
            result.valueWaitUri = valueWaitUri;
        }

        if (multiplexWaitUri) {
            debug.info('multiplex-wait: [' + multiplexWaitUri + ']');
            result.multiplexWaitUri = multiplexWaitUri;
        }

        if (multiplexWsUri) {
            debug.info('multiplex-ws: [' + multiplexWsUri + ']');
            result.multiplexWsUri = multiplexWsUri;
        }

        return result;
    }
}

module.exports = ValueEngineUnit;