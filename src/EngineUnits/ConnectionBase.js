class ConnectionBase {
    constructor(engine) {
        this._engine = engine;
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