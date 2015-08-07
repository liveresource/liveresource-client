var ConnectionsMap = require('Engine/ConnectionsMap');
var MultiplexWebSocketConnection = require('Aspects/Value/Engine/MultiplexWebSocketConnection');

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