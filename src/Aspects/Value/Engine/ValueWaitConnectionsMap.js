var ConnectionsMap = require('Engine/ConnectionsMap');
var ValueWaitConnection = require('Aspects/Value/Engine/ValueWaitConnection');

class ValueWaitConnectionsMap extends ConnectionsMap {
    constructor(engineUnit) {
        super(engineUnit);
    }

    get label() { return 'Value Wait'; }

    newConnection(engine, endpoint) {
        return new ValueWaitConnection(engine, endpoint);
    }
}

module.exports = ValueWaitConnectionsMap;