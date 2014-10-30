var debug;

if (DEBUG) {
    if (Function.prototype.bind) {
        debug = {
            log: window.console.log.bind(window.console),
            error: window.console.error.bind(window.console),
            info: window.console.info.bind(window.console),
            warn: window.console.warn.bind(window.console)
        };
    } else {
        var log = function(output) { window.console.log(output); };

        debug = {
            log: log,
            error: log,
            warn: log,
            info: log
        };
    }
} else {
    var __no_op = function() {};

    debug = {
        log: __no_op,
        error: __no_op,
        warn: __no_op,
        info: __no_op
    };
}