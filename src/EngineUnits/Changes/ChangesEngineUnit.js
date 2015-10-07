var utils = require('utils');

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