var utils = require('utils');

var EngineUnit = require('Engine/EngineUnit');
var ValueResource = require('Aspects/Value/Engine/ValueResource');
var ValueWaitConnectionsMap = require('Aspects/Value/Engine/ValueWaitConnectionsMap');
var MultiplexWebSocketConnectionsMap = require('Aspects/Value/Engine/MultiplexWebSocketConnectionsMap');
var MultiplexWaitConnectionsMap = require('Aspects/Value/Engine/MultiplexWaitConnectionsMap');

class ValueEngineUnit extends EngineUnit {
    constructor() {
        super();
        this._valueWaitConnectionsMap = new ValueWaitConnectionsMap(this);
        this._multiplexWebSocketConnectionsMap = new MultiplexWebSocketConnectionsMap(this);
        this._multiplexWaitConnectionsMap = new MultiplexWaitConnectionsMap(this);
    }

    addResource(resourceHandler) {
        this._addResourceHandler(resourceHandler, () => new ValueResource(
            resourceHandler.uri,
            resourceHandler.valueAspect.etag,
            resourceHandler.valueAspect.valueWaitUri,
            resourceHandler.valueAspect.multiplexWaitUri,
            resourceHandler.valueAspect.multiplexWsUri
        ));
    }

    update() {

        var valueWaitItems = {};
        var multiplexWebSocketItems = {};
        var multiplexWaitItems = {};

        utils.forEachOwnKeyValue(this._resources, (resUri, res) => {
            if (res.multiplexWebSocketUri) {
                var multiplexWebSocketPoll = utils.getOrCreateKey(multiplexWebSocketItems, res.multiplexWebSocketUri, () => ({items: []}));
                multiplexWebSocketPoll.items.push(res);
            } else if (res.multiplexWaitUri) {
                var multiplexWaitPoll = utils.getOrCreateKey(multiplexWaitItems, res.multiplexWaitUri, () => ({items: []}));
                multiplexWaitPoll.items.push(res);
            } else {
                valueWaitItems[res.valueWaitUri] = res;
            }
        });

        var valueWaitEndpoints = {};
        var multiplexWebSocketEndpoints = {};
        var multiplexWaitEndpoints = {};
        utils.forEachOwnKeyValue(multiplexWebSocketItems, (endpointUri, endpoint) => {
            multiplexWebSocketEndpoints[endpointUri] = { endpointUri, items: endpoint.items };
        });
        utils.forEachOwnKeyValue(multiplexWaitItems, (endpointUri, endpoint) => {
            if (endpoint.items.length > 1 || !endpoint.items[0].valueWaitUri) {
                multiplexWaitEndpoints[endpointUri] = { endpointUri, items: endpoint.items };
            } else {
                valueWaitItems[endpoint.items[0].valueWaitUri] = endpoint.items[0];
            }
        });
        utils.forEachOwnKeyValue(valueWaitItems, (endpointUri, endpoint) => {
            valueWaitEndpoints[endpointUri] = { endpointUri, item: endpoint };
        });

        this._valueWaitConnectionsMap.adjustEndpoints(valueWaitEndpoints);
        this._multiplexWebSocketConnectionsMap.adjustEndpoints(multiplexWebSocketEndpoints);
        this._multiplexWaitConnectionsMap.adjustEndpoints(multiplexWaitEndpoints);

    }

    get InterestType() {
        return 'value';
    }
}

module.exports = ValueEngineUnit;