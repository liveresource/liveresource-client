class Connection {
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

export default Connection;