import { toAbsoluteUri } from 'utils';
import parseLinkHeader from 'utils.parseLinkHeader';

import EngineUnitBase from 'EngineUnits/EngineUnitBase';
import ChangesResource from 'EngineUnits/Changes/ChangesResource';
import ChangesWaitConnection from 'EngineUnits/Changes/ChangesWaitConnection';

class ChangesEngineUnit extends EngineUnitBase {
    constructor() {
        super();

        this._changesWaitConnections = new Map();
    }

    update() {

        var resourceAspects = this.engine.getResourceAspectsForInterestType(this.interestType);

        var changesWaitItems = new Map();
        for (let res of resourceAspects) {
            if (res.changesWaitUri) {
                changesWaitItems.set(res.changesWaitUri, res);
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
                if (!resource.changesWaitUri) {
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
            var connection = this._changesWaitConnections.get(resource.changesWaitUri);
            if (connection) {
                this._changesWaitConnections.delete(resource.changesWaitUri);
            }
            // -- END HACK

            resource.changesWaitUri = parsedHeaders.changesWaitUri;

            // -- HACK
            if (connection) {
                this._changesWaitConnections.set(resource.changesWaitUri, connection);
                connection.uri = resource.changesWaitUri;
            }
            // -- END HACK
        }

        super.updateResource(resource, headers, result);
    }

    triggerEvents(resource, result) {

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