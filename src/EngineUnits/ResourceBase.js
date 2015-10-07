class ResourceBase {
    constructor(uri) {
        this.uri = uri;
        this.owners = [];
    }
}

module.exports = ResourceBase;