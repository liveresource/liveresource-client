import ResourceBase from 'EngineUnits/ResourceBase';

class ChangesResource extends ResourceBase {
    constructor(resourceHandler) {
        super(resourceHandler);
        this.started = false;
        this.changesWaitUri = null;
    }
}

export default ChangesResource;