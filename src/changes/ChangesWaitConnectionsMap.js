var ConnectionsMap = require('engine-components/ConnectionsMap');
var ChangesWaitConnection = require('changes/ChangesWaitConnection');

class ChangesWaitConnectionsMap extends ConnectionsMap {
    constructor(engineUnit) {
        super(engineUnit);
    }

    get label() { return 'Changes Wait'; }

    newConnection(engine, endpoint) {
        return new ChangesWaitConnection(endpoint, engine);
    }
}

module.exports = ChangesWaitConnectionsMap;