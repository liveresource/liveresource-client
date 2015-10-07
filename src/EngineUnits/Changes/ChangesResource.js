var utils = require('utils');
var parseLinkHeader = require('utils.parseLinkHeader');

var ResourceBase = require('EngineUnits/ResourceBase');

class ChangesResource extends ResourceBase {
    constructor(uri, changesWaitUri) {
        super(uri);
        this.changesWaitUri = changesWaitUri;
    }

    updateItem(headers, result) {

        utils.forEachOwnKeyValue(headers, (key, header) => {
            var lkey = key.toLowerCase();
            if (lkey == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['changes-wait']) {
                    this.changesWaitUri = links['changes-wait']['href'];
                    return false;
                }
            }
        });

        for (var i = 0; i < this.owners.length; i++) {
            var owner = this.owners[i];
            for (var n = 0; n < result.length; ++n) {
                if (result[n].deleted) {
                    owner.trigger('child-deleted', owner, result[n]);
                } else {
                    owner.trigger('child-added', owner, result[n]);
                }
            }
        }

    }
}

module.exports = ChangesResource;