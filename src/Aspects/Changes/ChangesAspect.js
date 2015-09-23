var utils = require('utils');
var debug = require('console');
var Pollymer = require('Pollymer');
var Aspect = require('ResourceHandling/Aspect');
var ChangesResource = require('Aspects/Changes/Engine/ChangesResource');

var parseLinkHeader = require('utils.parseLinkHeader');

class ChangesAspect extends Aspect {
    constructor(resourceHandler) {
        super(resourceHandler);
        this.started = false;
    }

    start() {
        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            var headerValues = this.parseHeaders(headers, this._resourceHandler.uri);

            if (code >= 200 && code < 300) {
                // 304 if not changed, don't trigger changes
                if (code < 300) {
                    for (var n = 0; n < result.length; ++n) {
                        if (result[n].deleted) {
                            this._resourceHandler.trigger('child-deleted', this._resourceHandler, result[n]);
                        } else {
                            this._resourceHandler.trigger('child-added', this._resourceHandler, result[n]);
                        }
                    }
                }
                if (headerValues.changesWaitUri) {
                    var engine = this._resourceHandler.resourceHandlerFactory.engine;
                    engine.addResourceHandler(this._resourceHandler, ChangesAspect.InterestType, () => new ChangesResource(
                        this._resourceHandler.uri,
                        headerValues.changesWaitUri
                    ));
                    if (!this.started) {
                        this.started = true;
                        this._resourceHandler.triggerOnceOnlyEvent('ready', this._resourceHandler);
                    }
                    request = null;
                } else {
                    debug.info('no changes-wait link');
                }
            } else if (code >= 400) {
                request.retry();
            }
        });
        request.start('HEAD', this._resourceHandler.uri);
    }

    parseHeaders(headers, baseUri) {
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

        var result = {};

        if (changesWaitUri) {
            debug.info('changes-wait: [' + changesWaitUri + ']');
            result.changesWaitUri = changesWaitUri;
        }

        return result;
    }

    static get InterestType() { return 'changes'; }
    static get Events() { return ['child-added', 'child-removed']; }
}

module.exports = ChangesAspect;