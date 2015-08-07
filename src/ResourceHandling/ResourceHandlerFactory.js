var utils = require('utils');
var ResourceHandler = require('ResourceHandling/ResourceHandler');

class ResourceHandlerFactory {
    constructor(engine) {
        this.engine = engine;
        this._resources = {};
        this._aspectClasses = {};
    }

    getHandlerForUri(uri) {
        return utils.getOrCreateKey(this._resources, uri, () => new ResourceHandler(this, uri));
    }

    addAspectClass(aspectClass) {
        var interestType = aspectClass.InterestType;
        this._aspectClasses[interestType] = aspectClass;
    }

    getAspectClass(interestType) {
        return this._aspectClasses[interestType];
    }

    findInterestTypeForEvent(eventName) {
        var interestType = null;
        utils.forEachOwnKeyValue(this._aspectClasses, (key, value) => {
            if (utils.findInArray(value.Events, eventName) >= 0) {
                interestType = key;
                return false;
            }
        });
        return interestType;
    }
}

module.exports = ResourceHandlerFactory;