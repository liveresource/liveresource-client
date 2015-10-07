var utils = require('utils');
var debug = require('console');

class EngineUnit {
    constructor() {
        this.engine = null;
        this._resources = {};
    }

    update() {
    }

    addResourceHandler(resourceHandler, createResource) {
        var resource = utils.getOrCreateKey(this._resources, resourceHandler.uri, createResource);
        resource.owners.push(resourceHandler);
        return resource;
    }

    get interestType() {
        return null;
    }

    _adjustEndpoints(label, connections, preferredEndpointsMap, createConnectionFunc) {

        // connections is a mapping of endpointUri -> connection
        // preferredEndpointsMap is a mapping of endpointUri -> endpoint

        // Keep track of list of new endpoints to enable
        var newEndpoints = {};
        for (let [endpointUri, endpoint] of utils.objectEntries(preferredEndpointsMap)) {
            newEndpoints[endpointUri] = endpoint;
        }

        // Make a list of endpoints to disable...
        var endpointsToDisable = [];
        for (let [endpointUri, connection] of utils.objectEntries(connections)) {
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
        }

        // ... and disable them.
        for (var i = 0; i < endpointsToDisable.length; i++) {
            var endpointUri = endpointsToDisable[i];
            debug.info(`Remove '${label}' endpoint - '${endpointUri}'.`);
            var connection = connections[endpointUri];
            connection.abort();
            delete connections[endpointUri];
        }

        // Create new requests for endpoints that need them.
        for (let [endpointUri, endpoint] of utils.objectEntries(newEndpoints)) {
            debug.info(`Adding '${label}' endpoint - '${endpointUri}'.`);
            connections[endpointUri] = createConnectionFunc(this, endpoint);
        }

        // For any current endpoint, make sure they are running.
        for (let [endpointUri, connection] of utils.objectEntries(connections)) {
            var endpoint = preferredEndpointsMap[endpointUri];
            connection.refresh(endpoint);
        }
    }}

module.exports = EngineUnit;