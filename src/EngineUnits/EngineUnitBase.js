var utils = require('utils');
var debug = require('console');

class EngineUnitBase {
    constructor() {
        this.engine = null;
    }

    update() {
    }

    updateEngine() {
        this.engine.update();
    }

    start(resourceHandler) {
        return null;
    }

    get interestType() {
        return null;
    }

    get events() {
        return null;
    }

    updateResources(uri, headers, result) {
        var resourceHandler = this.engine.getHandlerForUri(uri);
        var resourceAspect = resourceHandler.getResourceAspectForInterestType(this.interestType);
        if (resourceAspect != null) {
            this.updateResource(resourceAspect, headers, result);
        }
    }

    updateResource(resource, headers, result) {
        this.triggerEvents(resource, result);
    }

    triggerEvents(aspect, result) {
    }

    static parseHeaders(headers, baseUri) {
    }

    _adjustEndpoints(label, currentConnectionsMap, preferredEndpointsMap, createConnectionFunc) {

        // currentConnectionsMap is a mapping of endpointUri -> connection
        // preferredEndpointsMap is a mapping of endpointUri -> endpoint to update to

        // Keep track of list of new endpoints to enable
        var newEndpoints = new Map();
        for (let [endpointUri, endpoint] of preferredEndpointsMap) {
            newEndpoints.set(endpointUri, endpoint);
        }

        // Make a list of endpoints to disable...
        var endpointsToDisable = [];
        for (let [endpointUri, connection] of currentConnectionsMap) {
            // This item is already known, so remove endpoint from "new endpoints".
            newEndpoints.delete(endpointUri);

            var removedOrChanged = false;
            if (!preferredEndpointsMap.has(endpointUri)) {
                // If item is not in the preferred endpoints map, then it has been
                // removed. Mark for disabling.
                removedOrChanged = true;
            } else {
                // If item is in the preferred endpoints map, then
                // call "changeTest" to decide whether this item has changed.
                var endpoint = preferredEndpointsMap.get(endpointUri);
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
            var connection = currentConnectionsMap.get(endpointUri);
            connection.abort();
            currentConnectionsMap.delete(endpointUri);
        }

        // Create new requests for endpoints that need them.
        for (let [endpointUri, endpoint] of newEndpoints) {
            debug.info(`Adding '${label}' endpoint - '${endpointUri}'.`);
            currentConnectionsMap.set(endpointUri, createConnectionFunc(endpoint));
        }

        // For any current endpoint, make sure they are running.
        for (let [endpointUri, connection] of currentConnectionsMap) {
            var endpoint = preferredEndpointsMap.get(endpointUri);
            connection.refresh(endpoint);
        }
    }
}

module.exports = EngineUnitBase;