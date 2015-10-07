var utils = require('utils');

var EngineUnitBase = require('EngineUnits/EngineUnitBase');
var ValueAspect = require('EngineUnits/Value/ValueAspect');
var ValueWaitConnection = require('EngineUnits/Value/ValueWaitConnection');
var MultiplexWebSocketConnection = require('EngineUnits/Value/MultiplexWebSocketConnection');
var MultiplexWaitConnection = require('EngineUnits/Value/MultiplexWaitConnection');

class ValueEngineUnit extends EngineUnitBase {
    constructor() {
        super();

        this._valueWaitConnections = {};
        this._multiplexWebSocketConnections = {};
        this._multipleWaitConnections = {};
    }

    update() {

        var valueWaitItems = {};
        var multiplexWebSocketItems = {};
        var multiplexWaitItems = {};

        for (let [resUri, res] of utils.objectEntries(this._resources)) {
            if (res.multiplexWebSocketUri) {
                var multiplexWebSocketPoll = utils.getOrCreateKey(multiplexWebSocketItems, res.multiplexWebSocketUri, () => ({items: []}));
                multiplexWebSocketPoll.items.push(res);
            } else if (res.multiplexWaitUri) {
                var multiplexWaitPoll = utils.getOrCreateKey(multiplexWaitItems, res.multiplexWaitUri, () => ({items: []}));
                multiplexWaitPoll.items.push(res);
            } else {
                valueWaitItems[res.valueWaitUri] = res;
            }
        }

        var valueWaitEndpoints = {};
        var multiplexWebSocketEndpoints = {};
        var multiplexWaitEndpoints = {};
        for (let [endpointUri, endpoint] of utils.objectEntries(multiplexWebSocketItems)) {
            multiplexWebSocketEndpoints[endpointUri] = { endpointUri, items: endpoint.items };
        }
        for (let [endpointUri, endpoint] of utils.objectEntries(multiplexWaitItems)) {
            if (endpoint.items.length > 1 || !endpoint.items[0].valueWaitUri) {
                multiplexWaitEndpoints[endpointUri] = { endpointUri, items: endpoint.items };
            } else {
                valueWaitItems[endpoint.items[0].valueWaitUri] = endpoint.items[0];
            }
        }
        for (let [endpointUri, endpoint] of utils.objectEntries(valueWaitItems)) {
            valueWaitEndpoints[endpointUri] = { endpointUri, item: endpoint };
        }

        this._adjustEndpoints(
            'Value Wait',
            this._valueWaitConnections,
            valueWaitEndpoints,
            (engine, endpoint) => new ValueWaitConnection(engine, endpoint)
        );
        this._adjustEndpoints(
            'Multiplex Web Socket',
            this._multiplexWebSocketConnections,
            multiplexWebSocketEndpoints,
            (engine, endpoint) => new MultiplexWebSocketConnection(engine, endpoint, this._resources)
        );
        this._adjustEndpoints(
            'Multiplex Wait',
            this._multipleWaitConnections,
            multiplexWaitEndpoints,
            (engine, endpoint) => new MultiplexWaitConnection(engine, endpoint, this._resources)
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
}

module.exports = ValueEngineUnit;