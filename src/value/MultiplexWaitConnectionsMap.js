var ConnectionsMap = require('engine-components/ConnectionsMap');
var MultiplexWaitConnection = require('value/MultiplexWaitConnection');

class MultiplexWaitConnectionsMap extends ConnectionsMap {
    constructor(engineUnit) {
        super(engineUnit);
    }

    get label() { return 'Multiplex Wait'; }

    newConnection(engine, endpoint) {
        return new MultiplexWaitConnection(engine, endpoint, this._engineUnit);
    }
}

module.exports = MultiplexWaitConnectionsMap;