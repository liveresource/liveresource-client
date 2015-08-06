var utils = require('utils');
var debug = require('console');

class ConnectionsMap {
    constructor(engineUnit) {
        this._engineUnit = engineUnit;
        this._connections = {};
    }

    adjustEndpoints(preferredEndpointsMap) {

        // _connections is a mapping of endpointUri -> connection
        // preferredEndpointsMap is a mapping of endpointUri -> endpoint

        // Keep track of list of new endpoints to enable
        var newEndpoints = {};
        utils.forEachOwnKeyValue(preferredEndpointsMap, (endpointUri, endpoint) => {
            newEndpoints[endpointUri] = endpoint;
        });

        // Make a list of endpoints to disable...
        var endpointsToDisable = [];
        utils.forEachOwnKeyValue(this._connections, (endpointUri, connection) => {
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
            debug.info('Remove \'${this.label}\' endpoint - \'${endpointUri}\'.');
            var connection = this._connections[endpointUri];
            connection.abort();
            delete this._connections[endpointUri];
        }

        // Create new requests for endpoints that need them.
        utils.forEachOwnKeyValue(newEndpoints, (endpointUri, endpoint) => {
            debug.info('Adding \'${this.label}\' endpoint - \'${endpointUri}\'.');
            this._connections[endpointUri] = this.newConnection(this._engineUnit.engine, endpoint);
        });

        // For any current endpoint, make sure they are running.
        utils.forEachOwnKeyValue(this._connections, (endpointUri, connection) => {
            var endpoint = preferredEndpointsMap[endpointUri];
            connection.refresh(endpoint);
        });
    }

    get label() {
        throw 'unsupported';
    }

    newConnection(endpoint, engine) {
        throw 'unsupported';
    }
}

module.exports = ConnectionsMap;