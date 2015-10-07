var utils = require('utils');
var debug = require('console');
var mapWebSocketUrls = require('utils.mapWebSocketUrls');

class Engine {
    constructor() {
        this._engineUnits = [];
        this._updatePending = false;
    }

    update() {
        if (this._updatePending) {
            // Do nothing if we already have a pending update,
            return;
        }
        this._updatePending = true;
        
        process.nextTick(() => {
            this._updatePending = false;

            // restart our long poll
            debug.info('engine: setup long polls');

            for(var i = 0; i < this._engineUnits.length; i++) {
                var engineUnit = this._engineUnits[i];
                engineUnit.update();
            }
        });
    }

    addResourceHandler(resourceHandler, interestType, createResource) {
        for(var i = 0; i < this._engineUnits.length; i++) {
            var engineUnit = this._engineUnits[i];
            if (engineUnit.interestType == interestType) {
                engineUnit.addResourceHandler(resourceHandler, createResource);
                this.update();
                break;
            }
        }
    }

    addEngineUnit(engineUnit) {
        this._engineUnits.push(engineUnit);
        engineUnit.engine = this;
    }
    
    adjustEndpoints(label, connections, preferredEndpointsMap, createConnectionFunc) {
        
        // connections is a mapping of endpointUri -> connection
        // preferredEndpointsMap is a mapping of endpointUri -> endpoint

        // Keep track of list of new endpoints to enable
        var newEndpoints = {};
        utils.forEachOwnKeyValue(preferredEndpointsMap, (endpointUri, endpoint) => {
            newEndpoints[endpointUri] = endpoint;
        });

        // Make a list of endpoints to disable...
        var endpointsToDisable = [];
        utils.forEachOwnKeyValue(connections, (endpointUri, connection) => {
            // This item is already known, so remove endpoint from "new endpoints".
            delete newEndpoints[endpointUri];

            var removedOrChanged = false;
            if (!(endpointUri in preferredEndpointsMap)) {
                // If item is not in the preferred endpoints map, then it has been
                // removed. Mark for disabling.
                removedOrChanged = true;
            } else {
                // If item is in the preferred endpoints map, then
                // call "changeTest" to decide whether this item has changed.
                var endpoint = preferredEndpointsMap[endpointUri];
                removedOrChanged = connection.hasChanged(endpoint);
            }
            if (removedOrChanged) {
                // If marked, add to "delete" list
                endpointsToDisable.push(endpointUri);
            }
        });

        // ... and disable them.
        for (var i = 0; i < endpointsToDisable.length; i++) {
            var endpointUri = endpointsToDisable[i];
            debug.info(`Remove '${label}' endpoint - '${endpointUri}'.`);
            var connection = connections[endpointUri];
            connection.abort();
            delete connections[endpointUri];
        }

        // Create new requests for endpoints that need them.
        utils.forEachOwnKeyValue(newEndpoints, (endpointUri, endpoint) => {
            debug.info(`Adding '${label}' endpoint - '${endpointUri}'.`);
            connections[endpointUri] = createConnectionFunc(this, endpoint);
        });

        // For any current endpoint, make sure they are running.
        utils.forEachOwnKeyValue(connections, (endpointUri, connection) => {
            var endpoint = preferredEndpointsMap[endpointUri];
            connection.refresh(endpoint);
        });
    }    
}

module.exports = Engine;