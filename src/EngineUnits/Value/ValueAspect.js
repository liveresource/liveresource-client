var utils = require('utils');
var debug = require('console');
var Pollymer = require('Pollymer');
var AspectBase = require('EngineUnits/AspectBase');
var ValueResource = require('EngineUnits/Value/ValueResource');

class ValueAspect extends AspectBase {
    constructor(resourceHandler, engineUnit) {
        super(resourceHandler, engineUnit);
    }

    start() {
        var request = new Pollymer.Request();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 400) {
                var headerValues = this._engineUnit.parseHeaders(headers, this._resourceHandler.uri);

                // 304 if not changed, don't trigger value
                if (code < 300) {
                    this._engineUnit.triggerEvents(this._resourceHandler, result);
                }

                if (headerValues.etag) {
                    this._engineUnit.addResource(this._resourceHandler, () => new ValueResource(
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
}

module.exports = ValueAspect;