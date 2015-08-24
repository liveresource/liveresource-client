var ConnectionsMap = require('Engine/ConnectionsMap');
var ChangesWaitConnection = require('Aspects/Changes/Engine/ChangesWaitConnection');

class ChangesWaitConnectionsMap extends ConnectionsMap {
    constructor(engineUnit) {
        super(engineUnit);
    }

    get label() { return 'Changes Wait'; }

    newConnection(engine, endpoint) {
        return new ChangesWaitConnection(engine, endpoint);
    }
}

module.exports = ChangesWaitConnectionsMap;