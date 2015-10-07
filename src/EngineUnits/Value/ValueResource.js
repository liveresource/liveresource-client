var utils = require('utils');

var ValueEngineUnit = require('EngineUnits/Value/ValueEngineUnit');
var EngineResource = require('Engine/EngineResource');

class ValueResource extends EngineResource {
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

        utils.forEachOwnKeyValue(resources, (resourceUri, resource) => {
            if (resourceUri == uri) {
                resource.updateItem(headers, result);
            }
        });

    }
}

module.exports = ValueResource;