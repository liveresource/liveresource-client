import ResourcePart from 'Framework/ResourcePart';

class ValueResourcePart extends ResourcePart {
    constructor(resourceHandler) {
        super(resourceHandler);
        this.started = false;
        this.etag = null;
        this.valueWaitUri = null;
        this.multiplexWaitUri = null;
        this.multiplexWebSocketUri = null;
    }
}

export default ValueResourcePart;