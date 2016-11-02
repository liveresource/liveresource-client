const _loggers = [];

// Add an object that has a .logger member
export function addLogger(obj) {
    _loggers.push(obj);
}

export function log(type, message) {

    _loggers.forEach(obj => {
        if (obj.logger != null) {
            obj.logger(type, message);
        }
    });

}

export function debug(message) {
    log('debug', message);
}

export function info(message) {
    log('info', message);
}

export function warn(message) {
    log('warn', message);
}

export function error(message) {
    log('error', message);
}
