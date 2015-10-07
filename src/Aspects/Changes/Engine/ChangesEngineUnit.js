var utils = require('utils');

var EngineUnit = require('Engine/EngineUnit');
var ChangesAspect = require('Aspects/Changes/ChangesAspect');
var ChangesWaitConnection = require('Aspects/Changes/Engine/ChangesWaitConnection');

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

        this._adjustEndpoints(
            'Changes Wait',
            this._changesWaitConnections,
            changesWaitEndpoints,
            (engine, endpoint) => new ChangesWaitConnection(engine, endpoint)
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
}

module.exports = ChangesEngineUnit;