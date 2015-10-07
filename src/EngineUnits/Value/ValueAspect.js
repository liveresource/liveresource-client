var utils = require('utils');
var debug = require('console');
var Pollymer = require('Pollymer');
var AspectBase = require('EngineUnits/AspectBase');
var ValueResource = require('EngineUnits/Value/ValueResource');

var mapWebSocketUrls = require('utils.mapWebSocketUrls');
var parseLinkHeader = require('utils.parseLinkHeader');

class ValueAspect extends AspectBase {
    constructor(resourceHandler, engineUnit) {
        super(resourceHandler, engineUnit);
    }

    start() {
        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            var headerValues = this.parseHeaders(headers, this._resourceHandler.uri);

            if (code >= 200 && code < 400) {
                // 304 if not changed, don't trigger value
                if (code < 300) {
                    this._resourceHandler.trigger('value', this._resourceHandler, result);
                }
                if (headerValues.etag) {
                    this._engineUnit.addResourceHandler(this._resourceHandler, () => new ValueResource(
                        this._resourceHandler.uri,
                        headerValues.etag,
                        headerValues.valueWaitUri,
                        headerValues.multiplexWaitUri,
                        headerValues.multiplexWsUri
                    ));
                } else {
                    debug.info('no etag');
                }
                request = null;
            } else if (code >= 400) {
                if (code == 404) {
                    this._resourceHandler.trigger('removed', this._resourceHandler);
                    request = null;
                } else {
                    request.retry();
                }
            }
        });
        request.start('GET', this._resourceHandler.uri);
    }

    parseHeaders(headers, baseUri) {
        var etag = null;
        var valueWaitUri = null;
        var multiplexWaitUri = null;
        var multiplexWsUri = null;

        utils.forEachOwnKeyValue(headers, (key, header) => {

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

        var result = {};

        if (etag) {
            debug.info('etag: [' + etag + ']');
            result.etag = etag;
        }

        if (valueWaitUri) {
            debug.info('value-wait: [' + valueWaitUri + ']');
            result.valueWaitUri = valueWaitUri;
        }

        if (multiplexWaitUri) {
            debug.info('multiplex-wait: [' + multiplexWaitUri + ']');
            result.multiplexWaitUri = multiplexWaitUri;
        }

        if (multiplexWsUri) {
            debug.info('multiplex-ws: [' + multiplexWsUri + ']');
            result.multiplexWsUri = multiplexWsUri;
        }

        return result;
    }
}

module.exports = ValueAspect;