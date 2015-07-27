var utils = require('../utils');
var debug = require('console');
var mapWebSocketUrls = require('../utils.mapWebSocketUrls');
var parseLinkHeader = require('../utils.parseLinkHeader');

var ValueAspect = function() {
    if (!(this instanceof ValueAspect)) {
        throw new window.Error("Constructor called as a function");
    }
    this.etag = null;
    this.valueWaitUri = null;
    this.multiplexWaitUri = null;
    this.multiplexWsUri = null;
};

utils.extend(ValueAspect.prototype, {
    updateFromHeaders: function(baseUri, headers) {
        var etag = null;
        var valueWaitUri = null;
        var multiplexWaitUri = null;
        var multiplexWsUri = null;

        utils.forEachOwnKeyValue(headers, function(key, header) {

            var k = key.toLowerCase();
            if (k == 'etag') {
                etag = header;
            } else if (k == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['value-wait']) {
                    valueWaitUri = utils.toAbsoluteUri(baseUri, links['value-wait']['href']);
                }
                if (links && links['multiplex-wait']) {
                    multiplexWaitUri = utils.toAbsoluteUri(baseUri, links['multiplex-wait']['href']);
                }
                if (links && links['multiplex-ws']) {
                    multiplexWsUri = mapWebSocketUrls.mapHttpUrlToWebSocketUrl(utils.toAbsoluteUri(baseUri, links['multiplex-ws']['href']));
                }
            }

        });

        if (etag) {
            debug.info('etag: [' + etag + ']');
            this.etag = etag;
        }

        if (valueWaitUri) {
            debug.info('value-wait: [' + valueWaitUri + ']');
            this.valueWaitUri = valueWaitUri;
        }

        if (multiplexWaitUri) {
            debug.info('multiplex-wait: [' + multiplexWaitUri + ']');
            this.multiplexWaitUri = multiplexWaitUri;
        }

        if (multiplexWsUri) {
            debug.info('multiplex-ws: [' + multiplexWsUri + ']');
            this.multiplexWsUri = multiplexWsUri;
        }        
    }
});

module.exports = ValueAspect;