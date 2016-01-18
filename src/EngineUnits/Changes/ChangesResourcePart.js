import ResourcePart from 'Framework/ResourcePart';

class ChangesResourcePart extends ResourcePart {
    constructor(resourceHandler) {
        super(resourceHandler);
        this.started = false;
        this.changesWaitUri = null;
    }
}

export default ChangesResourcePart;