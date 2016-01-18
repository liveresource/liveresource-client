import { toAbsoluteUri } from 'utils';
import { parseLinkHeader } from 'utils.parseLinkHeader';

import EngineUnit from 'Framework/EngineUnit';
import ChangesResourcePart from 'EngineUnits/Changes/ChangesResourcePart';
import ChangesWaitConnection from 'EngineUnits/Changes/ChangesWaitConnection';

class ChangesEngineUnit extends EngineUnit {
    constructor() {
        super();

        this._changesWaitConnections = [];
    }

    updateEndpointsToResourceParts(parts) {

        var changesWaitItems = new Map();
        parts.forEach(part => {
            if (part.linkUris['CHANGES_WAIT']) {
                changesWaitItems.set(part.linkUris['CHANGES_WAIT'], part);
            }
        });

        var changesWaitEndpoints = new Map();
        changesWaitItems.forEach((endpoint, endpointUri) => {
            changesWaitEndpoints.set(endpointUri, { endpointUri, item: endpoint });
        });

        this.updateConnectionsToMatchEndpoints(
            'Changes Wait',
            this._changesWaitConnections,
            changesWaitEndpoints,
            endpoint => new ChangesWaitConnection(this, endpoint)
        );
    }

    createResourcePart(resourceHandler) {
        var resource = new ChangesResourcePart(resourceHandler);

        var request = this.createLongPoll();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 300) {
                this.updateResourcePart(resource, headers, result);
                if (!resource.linkUris['CHANGES_WAIT']) {
                    console.info('no changes-wait link');
                }
                this.updateEngine();
                request = null;
            } else if (code >= 400) {
                request.retry();
            }
        });
        request.start('HEAD', resourceHandler.uri);

        return resource;
    }

    get interestType() {
        return 'changes';
    }

    get events() {
        return ['child-added', 'child-removed'];
    }

    updateResourcePart(resourcePart, headers, result) {

        var parsedHeaders = ChangesEngineUnit.parseHeaders(headers, resourcePart.resourceHandler.uri);
        if (parsedHeaders.changesWaitUri) {

            // need to also update connection as to reuse its resources.
            var connection = this._changesWaitConnections
                .find(connection => connection.uri == resourcePart.linkUris['CHANGES_WAIT']);

            resourcePart.linkUris['CHANGES_WAIT'] = parsedHeaders.changesWaitUri;

            if (connection != null) {
                connection.uri = resourcePart.linkUris['CHANGES_WAIT'];
            }
        }

        super.updateResourcePart(resourcePart, headers, result);
    }

    triggerEvents(part, result) {

        // TODO: This timing of emitting 'ready' is incorrect.
        // It should be done separately, because it means the listening connection
        // is established.
        if (!part.started) {
            part.started = true;
            part.resourceHandler.triggerOnceOnlyEvent('ready', part.resourceHandler);
        }

        if (result != null && result != "") {
            result.forEach(resultItem => {
                if (resultItem.deleted) {
                    part.resourceHandler.trigger('child-deleted', part.resourceHandler, resultItem);
                } else {
                    part.resourceHandler.trigger('child-added', part.resourceHandler, resultItem);
                }
            });
        }
    }

    static parseHeaders(headers, baseUri) {
        var changesWaitUri = null;

        Object.keys(headers).forEach(key => {
            const header = headers[key];
            var k = key.toLowerCase();
            if (k == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['changes-wait']) {
                    changesWaitUri = toAbsoluteUri(baseUri, links['changes-wait']['href']);
                }
            }
        });

        var result = {};

        if (changesWaitUri) {
            console.info('changes-wait: [' + changesWaitUri + ']');
            result.changesWaitUri = changesWaitUri;
        }

        return result;
    }
}

export default ChangesEngineUnit;