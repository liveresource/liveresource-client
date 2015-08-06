var ConnectionsMap = require('engine-components/ConnectionsMap');
var MultiplexWebSocketConnection = require('value/MultiplexWebSocketConnection');

class MultiplexWebSocketConnectionsMap extends ConnectionsMap {
    constructor(engineUnit) {
        super(engineUnit);
    }

    get label() { return 'Multiplex Web Socket'; }

    newConnection(engine, endpoint) {
        return new MultiplexWebSocketConnection(engine, endpoint, this._engineUnit);
    }
}

module.exports = MultiplexWebSocketConnectionsMap;