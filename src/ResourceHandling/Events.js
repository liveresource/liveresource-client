class Events {
    constructor() {
        this._events = {};
    }

    on(type, handler) {
        if (this._events[type] == null) {
            this._events[type] = [];
        }

        this._events[type].push(handler);
        return () => {
            if (this._events[type] != null) {
                this._events[type] = this._events[type].filter(h => h != handler);
            }
        };
    }

    trigger(type, obj, ...args) {
        if (this._events[type] != null) {
            this._events[type].slice().forEach(handler => handler.apply(obj, args));
        }
    }
}

export default Events;