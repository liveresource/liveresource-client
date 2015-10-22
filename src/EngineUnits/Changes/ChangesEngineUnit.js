var utils = require('utils');
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

    updateResources(resources, uri, headers, result) {

        for (var [resourceUri, resource] of resources) {
            if (resourceUri == uri) {
                this.updateResource(resource, headers, result);
            }
        }

    }

    updateResource(resource, headers, result) {

        console.dir (headers)

        utils.forEachOwnKeyValue(headers, (key, header) => {
            var lkey = key.toLowerCase();
            if (lkey == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['changes-wait']) {
                    resource.changesWaitUri = links['changes-wait']['href'];
                    return false;
                }
            }
        });

        for (var i = 0; i < resource.owners.length; i++) {
            var owner = resource.owners[i];
            for (var n = 0; n < result.length; ++n) {
                if (result[n].deleted) {
                    owner.trigger('child-deleted', owner, result[n]);
                } else {
                    owner.trigger('child-added', owner, result[n]);
                }
            }
        }

    }
}

module.exports = ChangesEngineUnit;