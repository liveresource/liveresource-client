import ResourcePart from '../../Framework/ResourcePart';

class ChangesResourcePart extends ResourcePart {
    constructor(resourceHandler) {
        super(resourceHandler);

        this.started = false;
        this.linkUris['CHANGES_WAIT'] = null;
    }
}

export default ChangesResourcePart;