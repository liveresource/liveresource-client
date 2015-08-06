var utils = require('utils');

var EngineUnit = require('engine-components/EngineUnit');
var ChangesWaitConnectionsMap = require('changes/ChangesWaitConnectionsMap');
var ChangesResource = require('changes/ChangesResource');

class ChangesEngineUnit extends EngineUnit {
    constructor(engine) {
        super(engine);
        this._changesWaitConnectionsMap = new ChangesWaitConnectionsMap(engine);
    }

    addResource(resourceHandler) {
        this._getOrCreateResource(resourceHandler.uri, resourceHandler, uri => new ChangesResource(
            uri,
            resourceHandler.changesAspect.changesWaitUri
        ));
    }

    update() {

        var changesWaitItems = {};
        utils.forEachOwnKeyValue(this._resources, (resUri, res) => {
            if (res.changesWaitUri) {
                changesWaitItems[res.changesWaitUri] = res;
            }
        });

        var changesWaitEndpoints = {};
        utils.forEachOwnKeyValue(changesWaitItems, (endpointUri, endpoint) => {
            changesWaitEndpoints[endpointUri] = { endpointUri, item: endpoint };
        });

        this._changesWaitConnectionsMap.adjustEndpoints(changesWaitEndpoints);

    }

    get InterestType() {
        return 'changes';
    }
}

module.exports = ChangesEngineUnit;