var utils = require('utils');
var debug = require('console');
var parseLinkHeader = require('utils.parseLinkHeader');

var EngineUnitBase = require('EngineUnits/EngineUnitBase');
var ChangesAspect = require('EngineUnits/Changes/ChangesAspect');
var ChangesWaitConnection = require('EngineUnits/Changes/ChangesWaitConnection');

class ChangesEngineUnit extends EngineUnitBase {
    constructor() {
        super();

        this._changesWaitConnections = new Map();
    }

    update() {

        var changesWaitItems = new Map();
        for (let [resUri, res] of this._resources) {
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

    createAspect(resourceHandler) {
        return new ChangesAspect(resourceHandler, this);
    }

    get interestType() {
        return 'changes';
    }

    get events() {
        return ['child-added', 'child-removed'];
    }

    updateResource(resource, headers, result) {

        var parsedHeaders  = this.parseHeaders(headers, resource.uri);
        if (parsedHeaders.changesWaitUri) {
            resource.changesWaitUri = parsedHeaders.changesWaitUri;
        }

        super.updateResource(resource, headers, result);
    }

    parseHeaders(headers, baseUri) {
        var changesWaitUri = null;

        utils.forEachOwnKeyValue(headers, (key, header) => {
            var k = key.toLowerCase();
            if (k == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['changes-wait']) {
                    changesWaitUri = utils.toAbsoluteUri(baseUri, links['changes-wait']['href']);
                }
            }
        });

        var result = {};

        if (changesWaitUri) {
            debug.info('changes-wait: [' + changesWaitUri + ']');
            result.changesWaitUri = changesWaitUri;
        }

        return result;
    }

    triggerEvents(resourceHandler, result) {
        for (var n = 0; n < result.length; ++n) {
            if (result[n].deleted) {
                resourceHandler.trigger('child-deleted', resourceHandler, result[n]);
            } else {
                resourceHandler.trigger('child-added', resourceHandler, result[n]);
            }
        }
    }
}

module.exports = ChangesEngineUnit;