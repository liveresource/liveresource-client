var debug;

if (DEBUG) {
    debug = {
        log: window.console.log.bind(window.console),
        error: window.console.error.bind(window.console),
        info: window.console.info.bind(window.console),
        warn: window.console.warn.bind(window.console)
    };
} else {
    var __no_op = function() {};
    debug = {
        log: __no_op,
        error: __no_op,
        warn: __no_op,
        info: __no_op
    };
}