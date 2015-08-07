var utils = require('utils');

var EngineUnit = require('Engine/EngineUnit');
var ChangesWaitConnectionsMap = require('Aspects/Changes/Engine/ChangesWaitConnectionsMap');
var ChangesResource = require('Aspects/Changes/Engine/ChangesResource');

class ChangesEngineUnit extends EngineUnit {
    constructor(engine) {
        super(engine);
        this._changesWaitConnectionsMap = new ChangesWaitConnectionsMap(engine);
    }

    addResource(resourceHandler) {
        this._addResourceHandler(resourceHandler, () => new ChangesResource(
            resourceHandler.uri,
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
        return 'Changes';
    }
}

module.exports = ChangesEngineUnit;