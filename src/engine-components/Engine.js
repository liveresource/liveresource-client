var utils = require('utils');
var debug = require('console');
var mapWebSocketUrls = require('utils.mapWebSocketUrls');

class Engine {
    constructor() {
        this._engineUnits = [];
        this._updatePending = false;
    }

    update() {
        if (!this._updatePending) {
            this._updatePending = true;
            process.nextTick(() => {
                this._updatePending = false;

                // restart our long poll
                debug.info('engine: setup long polls');

                for(var i = 0; i < this._engineUnits.length; i++) {
                    var engineUnit = this._engineUnits[i];
                    engineUnit.update();
                }
            });
        }
    }

    addResource(resourceHandler, interestType) {
        for(var i = 0; i < this._engineUnits.length; i++) {
            var engineUnit = this._engineUnits[i];
            if (engineUnit.InterestType == interestType) {
                engineUnit.addResource(resourceHandler);
                this.update();
                break;
            }
        }
    }

    addObjectResource(resourceHandler) {
        this.addResource(resourceHandler, 'value');
    }

    addCollectionResource(resourceHandler) {
        this.addResource(resourceHandler, 'changes');
    }

    addEngineUnit(engineUnit) {
        this._engineUnits.push(engineUnit);
        engineUnit.engine = this;
    }
}

// We only export the "getSharedEngine" function here

var _engine = null;
var getSharedEngine = function() {
    if (_engine == null) {
        _engine = new Engine();
    }
    return _engine;
};

module.exports = getSharedEngine;