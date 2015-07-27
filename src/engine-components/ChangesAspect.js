var utils = require('../utils');
var debug = require('console');
var parseLinkHeader = require('../utils.parseLinkHeader');

var ChangesAspect = function() {
    if (!(this instanceof ChangesAspect)) {
        throw new window.Error("Constructor called as a function");
    }
    this.changesWaitUri = null;
    this.started = false;
};

utils.extend(ChangesAspect.prototype, {
    updateFromHeaders: function(baseUri, headers) {
        var changesWaitUri = null;

        utils.forEachOwnKeyValue(headers, function(key, header) {

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
});

module.exports = ChangesAspect;