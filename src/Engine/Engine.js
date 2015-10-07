var utils = require('utils');
var debug = require('console');
var mapWebSocketUrls = require('utils.mapWebSocketUrls');

class Engine {
    constructor() {
        this._engineUnits = [];
        this._updatePending = false;
    }

    update() {
        if (this._updatePending) {
            // Do nothing if we already have a pending update,
            return;
        }
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

    addResourceHandler(resourceHandler, interestType, createResource) {
        for(var i = 0; i < this._engineUnits.length; i++) {
            var engineUnit = this._engineUnits[i];
            if (engineUnit.InterestType == interestType) {
                engineUnit.addResourceHandler(resourceHandler, createResource);
                this.update();
                break;
            }
        }
    }

    addEngineUnit(engineUnit) {
        this._engineUnits.push(engineUnit);
        engineUnit.engine = this;
    }
}

module.exports = Engine;