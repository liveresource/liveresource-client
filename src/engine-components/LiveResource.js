var LiveResource = function (uri) {
    if (!(this instanceof LiveResource)) {
        throw new window.Error("Constructor called as a function");
    }

    this._events = new Events();

    var absoluteUri = utils.toAbsoluteUri(window.location.href, uri);
    this._resourceHandler = ResourceHandler.get(absoluteUri);
    this._resourceHandler.addLiveResource(this);
};

utils.extend(LiveResource.prototype, {
    on: function (type, handler) {
        this._events.on(type, handler);
        this._resourceHandler.addEvent(type);
    },
    off: function (type, handler) {
        var args = utils.copyArray(arguments, 1);
        args.unshift(type);
        this._events.off.apply(this._events, args);
    }
});
