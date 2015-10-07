var utils = require('utils');

var EngineUnit = require('Engine/EngineUnit');
var ValueWaitConnection = require('Aspects/Value/Engine/ValueWaitConnection');
var MultiplexWebSocketConnection = require('Aspects/Value/Engine/MultiplexWebSocketConnection');
var MultiplexWaitConnection = require('Aspects/Value/Engine/MultiplexWaitConnection');

class ValueEngineUnit extends EngineUnit {
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

        this.engine.adjustEndpoints(
            'Value Wait',
            this._valueWaitConnections,
            valueWaitEndpoints,
            (engine, endpoint) => new ValueWaitConnection(engine, endpoint)
        );
        this.engine.adjustEndpoints(
            'Multiplex Web Socket',
            this._multiplexWebSocketConnections,
            multiplexWebSocketEndpoints,
            (engine, endpoint) => new MultiplexWebSocketConnection(engine, endpoint, this._resources)
        );
        this.engine.adjustEndpoints(
            'Multiplex Wait',
            this._multipleWaitConnections,
            multiplexWaitEndpoints,
            (engine, endpoint) => new MultiplexWaitConnection(engine, endpoint, this._resources)
        );

    }

    get interestType() {
        return 'value';
    }
}

module.exports = ValueEngineUnit;