var utils = require('utils');
var debug = require('console');
var Pollymer = require('Pollymer');
var AspectBase = require('EngineUnits/AspectBase');
var ChangesResource = require('EngineUnits/Changes/ChangesResource');

var parseLinkHeader = require('utils.parseLinkHeader');

class ChangesAspect extends AspectBase {
    constructor(resourceHandler, engineUnit) {
        super(resourceHandler, engineUnit);
        this.started = false;
    }

    start() {
        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 400) {
                // The initial request is HEAD only, so it contains only headers.
                // So we do nothing with result
                var headerValues = this._engineUnit.parseHeaders(headers, this._resourceHandler.uri);
                if (headerValues.changesWaitUri) {
                    this._engineUnit.addResource(this._resourceHandler, () => new ChangesResource(
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
}

module.exports = ChangesAspect;