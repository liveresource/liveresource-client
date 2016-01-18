import { toAbsoluteUri } from 'utils';
import { parseLinkHeader } from 'utils.parseLinkHeader';

import EngineUnit from 'Framework/EngineUnit';
import ChangesResource from 'EngineUnits/Changes/ChangesResourcePart';
import ChangesWaitConnection from 'EngineUnits/Changes/ChangesWaitConnection';

class ChangesEngineUnit extends EngineUnit {
    constructor() {
        super();

        this._changesWaitConnections = new Map();
    }

    updateWithParts(parts) {

        var changesWaitItems = new Map();
        for (let res of parts) {
            if (res.linkUris['CHANGES_WAIT']) {
                changesWaitItems.set(res.linkUris['CHANGES_WAIT'], res);
            }
        }

        var changesWaitEndpoints = new Map();
        for (let [endpointUri, endpoint] of changesWaitItems) {
            changesWaitEndpoints.set(endpointUri, { endpointUri, item: endpoint });
        }

        this._adjustEndpoints(
            'Changes Wait',
            this._changesWaitConnections,
            changesWaitEndpoints,
            endpoint => new ChangesWaitConnection(this, endpoint)
        );

    }

    start(resourceHandler) {
        var resource = new ChangesResource(resourceHandler);

        var request = this.createLongPoll();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 300) {
                this.updateResource(resource, headers, result);
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

    updateResource(resource, headers, result) {

        var parsedHeaders = ChangesEngineUnit.parseHeaders(headers, resource.resourceHandler.uri);
        if (parsedHeaders.changesWaitUri) {
            // -- HACK: Try to reuse Pollymer requests for this, for now.
            var connection = this._changesWaitConnections.get(resource.linkUris['CHANGES_WAIT']);
            if (connection) {
                this._changesWaitConnections.delete(resource.linkUris['CHANGES_WAIT']);
            }
            // -- END HACK

            resource.linkUris['CHANGES_WAIT'] = parsedHeaders.changesWaitUri;

            // -- HACK
            if (connection) {
                this._changesWaitConnections.set(resource.linkUris['CHANGES_WAIT'], connection);
                connection.uri = resource.linkUris['CHANGES_WAIT'];
            }
            // -- END HACK
        }

        super.updateResource(resource, headers, result);
    }

    triggerEvents(resource, result) {

        // TODO: This timing of emitting 'ready' is incorrect.
        // It should be done separately, because it means the listening connection
        // is established.
        if (!resource.started) {
            resource.started = true;
            resource.resourceHandler.triggerOnceOnlyEvent('ready', resource.resourceHandler);
        }

        for (var n = 0; n < result.length; ++n) {
            if (result[n].deleted) {
                resource.resourceHandler.trigger('child-deleted', resource.resourceHandler, result[n]);
            } else {
                resource.resourceHandler.trigger('child-added', resource.resourceHandler, result[n]);
            }
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