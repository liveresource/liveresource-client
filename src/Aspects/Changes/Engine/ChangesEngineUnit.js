var utils = require('utils');

var EngineUnit = require('Engine/EngineUnit');
var ChangesWaitConnection = require('Aspects/Changes/Engine/ChangesWaitConnection');
var ChangesResource = require('Aspects/Changes/Engine/ChangesResource');

class ChangesEngineUnit extends EngineUnit {
    constructor() {
        super();

        this._changesWaitConnections = {};
    }

    update() {

        var changesWaitItems = {};
        for (let [resUri, res] of utils.objectEntries(this._resources)) {
            if (res.changesWaitUri) {
                changesWaitItems[res.changesWaitUri] = res;
            }
        }

        var changesWaitEndpoints = {};
        for (let [endpointUri, endpoint] of utils.objectEntries(changesWaitItems)) {
            changesWaitEndpoints[endpointUri] = { endpointUri, item: endpoint };
        }

        this.engine.adjustEndpoints(
            'Changes Wait',
            this._changesWaitConnections,
            changesWaitEndpoints,
            (engine, endpoint) => new ChangesWaitConnection(engine, endpoint)
        );

    }

    get interestType() {
        return 'changes';
    }
}

module.exports = ChangesEngineUnit;