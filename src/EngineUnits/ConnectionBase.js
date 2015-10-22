class ConnectionBase {
    constructor(engineUnit) {
        this._engineUnit = engineUnit;
    }

    hasChanged(endpoint) {
        throw false;
    }

    abort() {
    }

    refresh(endpoint) {
    }
}

module.exports = ConnectionBase;