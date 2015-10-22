var utils = require('utils');

var EngineUnitBase = require('EngineUnits/EngineUnitBase');
var ValueAspect = require('EngineUnits/Value/ValueAspect');
var ValueWaitConnection = require('EngineUnits/Value/ValueWaitConnection');
var MultiplexWebSocketConnection = require('EngineUnits/Value/MultiplexWebSocketConnection');
var MultiplexWaitConnection = require('EngineUnits/Value/MultiplexWaitConnection');

class ValueEngineUnit extends EngineUnitBase {
    constructor() {
        super();

        this._valueWaitConnections = new Map();
        this._multiplexWebSocketConnections = new Map();
        this._multipleWaitConnections = new Map();
    }

    update() {

        var valueWaitItems = new Map();
        var multiplexWebSocketItems = new Map();
        var multiplexWaitItems = new Map();

        for (let [resUri, res] of this._resources) {
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
            endpoint => new MultiplexWebSocketConnection(this, endpoint, this._resources)
        );
        this._adjustEndpoints(
            'Multiplex Wait',
            this._multipleWaitConnections,
            multiplexWaitEndpoints,
            endpoint => new MultiplexWaitConnection(this, endpoint, this._resources)
        );

    }

    createAspect(resourceHandler) {
        return new ValueAspect(resourceHandler, this);
    }

    get interestType() {
        return 'value';
    }

    get events() {
        return ['value', 'removed'];
    }

    updateResources(resources, uri, headers, result) {

        for (var [resourceUri, resource] of resources) {
            if (resourceUri == uri) {
                this.updateResource(resource, headers, result);
            }
        }

    }

    updateResource(resource, headers, result) {

        utils.forEachOwnKeyValue(headers, (key, header) => {
            var lowercaseKey = key.toLocaleLowerCase();
            if (lowercaseKey == 'etag') {
                resource.etag = header;
                return false;
            }
        });

        for (var i = 0; i < resource.owners.length; i++) {
            var owner = resource.owners[i];
            owner.trigger('value', owner, result);
        }

    }
}

module.exports = ValueEngineUnit;