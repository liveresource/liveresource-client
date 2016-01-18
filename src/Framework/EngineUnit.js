import Pollymer from 'Pollymer';

class EngineUnit {
    constructor() {
        this.engine = null;
    }

    update() {
        var resourceParts = this.engine.getAllResourcePartsForInterestType(this.interestType);
        this.updateEndpointsToResourceParts(resourceParts);
    }

    updateEndpointsToResourceParts(resourceParts) {
    }

    updateEngine() {
        this.engine.update();
    }

    createResourcePart(resourceHandler) {
        return null;
    }

    get interestType() {
        return null;
    }

    get events() {
        return null;
    }

    updateResources(uri, headers, result) {
        const resourceHandler = this.engine.getHandlerForUri(uri);
        const resourcePart = resourceHandler.getResourcePart(this.interestType);
        if (resourcePart != null) {
            this.updateResourcePart(resourcePart, headers, result);
        }
    }

    updateResourcePart(resourcePart, headers, result) {
        this.triggerEvents(resourcePart, result);
    }

    triggerEvents(resourcePart, result) {
    }

    static parseHeaders(headers, baseUri) {
    }

    createLongPoll() {
        const request = new Pollymer.Request();
        this.setLongPollOptions(request);
        return request;
    }

    setLongPollOptions(request) {
        // We are going to use 'parser' to do this
        request.rawResponse = true;

        if (this.engine.options.longPollTimeoutMsecs) {
            request.timeout = this.engine.options.longPollTimeoutMsecs;
        } else {
            request.timeout = 60000;
        }
        if (this.engine.options.maxLongPollDelayMsecs) {
            request.maxDelay = this.engine.options.maxLongPollDelayMsecs;
        } else {
            request.maxDelay = 1000;
        }
    }

    updateConnectionsToMatchEndpoints(label, currentConnections, preferredEndpointsMap, createConnectionFunc) {

        // currentConnectionsMap is a mapping of endpointUri -> connection
        // preferredEndpointsMap is a mapping of endpointUri -> endpoint to update to

        var currentConnectionsMap = new Map();
        currentConnections.forEach(item => {
            currentConnectionsMap.set(item.uri, item);
        });

        // Keep track of list of new endpoints to enable
        const newEndpoints = new Map();
        preferredEndpointsMap.forEach((endpoint, endpointUri) => {
            newEndpoints.set(endpointUri, endpoint);
        });

        // Make a list of endpoints to disable...
        const endpointsToDisable = [];
        currentConnectionsMap.forEach((connection, endpointUri) => {
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
        });

        // ... and disable them.
        endpointsToDisable.forEach(endpointUri => {
            console.info(`Remove '${label}' endpoint - '${endpointUri}'.`);
            const connection = currentConnectionsMap.get(endpointUri);
            connection.abort();
            currentConnectionsMap.delete(endpointUri);
        });

        // Create new requests for endpoints that need them.
        newEndpoints.forEach((endpoint, endpointUri) => {
            console.info(`Adding '${label}' endpoint - '${endpointUri}'.`);
            currentConnectionsMap.set(endpointUri, createConnectionFunc(endpoint));
        });

        // For any current endpoint, make sure they are running.
        currentConnections.length = 0;
        currentConnectionsMap.forEach((connection, endpointUri) => {
            const endpoint = preferredEndpointsMap.get(endpointUri);
            connection.refresh(endpoint);
            currentConnections.push(connection);
        });
    }

    updateConnection(resourcePart, connections, linkType, newLinkUri) {
        if (newLinkUri) {
            var connection = connections.find(conn => conn.uri === resourcePart.linkUris[linkType]);
            if (connection != null) {
                connection.uri = newLinkUri;
            }
            resourcePart.linkUris[linkType] = newLinkUri;

        }
    }
}

export default EngineUnit;