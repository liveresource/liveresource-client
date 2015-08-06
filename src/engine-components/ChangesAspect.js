var utils = require('utils');
var debug = require('console');
var parseLinkHeader = require('utils.parseLinkHeader');

class ChangesAspect {
    constructor() {
        this.changesWaitUri = null;
        this.started = false;
    }

    updateFromHeaders(baseUri, headers) {
        var changesWaitUri = null;

        utils.forEachOwnKeyValue(headers, (key, header) => {

            var k = key.toLowerCase();
            if (k == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['changes-wait']) {
                    changesWaitUri = utils.toAbsoluteUri(baseUri, links['changes-wait']['href']);
                }
            }

        });

        if (changesWaitUri) {
            debug.info('changes-wait: [' + changesWaitUri + ']');
            this.changesWaitUri = changesWaitUri;
        }
    }
}

module.exports = ChangesAspect;