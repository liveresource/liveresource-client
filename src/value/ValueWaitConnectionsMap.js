var ConnectionsMap = require('engine-components/ConnectionsMap');
var ValueWaitConnection = require('value/ValueWaitConnection');

class ValueWaitConnectionsMap extends ConnectionsMap {
    constructor(engineUnit) {
        super(engineUnit);
    }

    get label() { return 'Value Wait'; }

    newConnection(engine, endpoint) {
        return new ValueWaitConnection(engine, endpoint)
    }
}

module.exports = ValueWaitConnectionsMap;