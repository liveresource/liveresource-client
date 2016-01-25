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
        var resourceParts = [];

        this._resourceHandlers.forEach(resourceHandler => {
            var resourcePart = resourceHandler.getResourcePart(interestType);
            if (resourcePart != null) {
                resourceParts.push(resourcePart);
            }
        });

        return resourceParts;
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
        return this._engineUnits.find(engineUnit => engineUnit.events.indexOf(eventName) >= 0);
    }

    findEngineUnitForInterestType(interestType) {
        return this._engineUnits.find(engineUnit => engineUnit.interestType == interestType);
    }

    defaultParser(interestType, headers, data) {
        const engineUnit = this.findEngineUnitForInterestType(interestType);
        return engineUnit != null ? engineUnit.defaultParser(headers, data) : null;
    }
}

export default Engine;