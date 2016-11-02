import ResourcePart from '../../Framework/ResourcePart';

class ValueResourcePart extends ResourcePart {
    constructor(resourceHandler) {
        super(resourceHandler);

        this.etag = null;
        this.linkUris['VALUE_WAIT'] = null;
        this.linkUris['MULTIPLEX_WAIT'] = null;
        this.linkUris['MULTIPLEX_WS'] = null;
    }
}

export default ValueResourcePart;