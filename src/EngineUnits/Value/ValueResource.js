var utils = require('utils');

var ValueEngineUnit = require('EngineUnits/Value/ValueEngineUnit');
var ResourceBase = require('EngineUnits/ResourceBase');

class ValueResource extends ResourceBase {
    constructor(uri, etag, valueWaitUri, multiplexWaitUri, multiplexWebSocketUri) {
        super(uri);
        this.etag = etag;
        this.valueWaitUri = valueWaitUri;
        this.multiplexWaitUri = multiplexWaitUri;
        this.multiplexWebSocketUri = multiplexWebSocketUri;
    }

    updateItem(headers, result) {

        utils.forEachOwnKeyValue(headers, (key, header) => {
            var lowercaseKey = key.toLocaleLowerCase();
            if (lowercaseKey == 'etag') {
                this.etag = header;
                return false;
            }
        });

        for (var i = 0; i < this.owners.length; i++) {
            var owner = this.owners[i];
            owner.trigger('value', owner, result);
        }

    }

    static updateValueItemMultiplex(resources, uri, headers, result) {

        for (var [resourceUri, resource] of resources) {
            if (resourceUri == uri) {
                resource.updateItem(headers, result);
            }
        }

    }
}

module.exports = ValueResource;