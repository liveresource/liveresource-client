import { getOrCreateEntry } from 'utils';
import mapWebSocketUrls from 'utils.mapWebSocketUrls';

import ResourceHandler from 'Framework/ResourceHandler';

class Engine {
    constructor() {
        this._resourceHandlers = new Map();
        this._engineUnits = [];
        this._updatePending = false;

        this.options = {
            longPollTimeoutMsecs: 0,
            maxLongPollDelayMsecs: 0
        };
    }

    setGlobalOptions(options) {
        this.options = options;
    }

    getHandlerForUri(uri) {
        return getOrCreateEntry(this._resourceHandlers, uri, () => new ResourceHandler(this, uri));
    }

    getAllResourcePartsForInterestType(interestType) {
        var resourceAspects = [];

        this._resourceHandlers.forEach(resourceHandler => {
            var resourceAspect = resourceHandler.getResourcePart(interestType);
            if (resourceAspect != null) {
                resourceAspects.push(resourceAspect);
            }
        });

        return resourceAspects;
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
            console.info('engine: setup long polls');

            this._engineUnits.forEach(engineUnit => {
                engineUnit.update();
            });
        });
    }

    addEngineUnit(engineUnit) {
        this._engineUnits.push(engineUnit);
        engineUnit.engine = this;
    }

    findEngineUnitForEvent(eventName) {
        for (var i = 0; i < this._engineUnits.length; i++) {
            var engineUnit = this._engineUnits[i];
            if (engineUnit.events.indexOf(eventName) >= 0) {
                return engineUnit;
            }
        }
        return null;
    }
}

export default Engine;