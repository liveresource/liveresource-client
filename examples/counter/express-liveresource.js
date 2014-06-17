var url = require('url');
var WebSocketServer = require('ws').Server;
var httpMocks = require('./node-mocks-http/http-mock.js');

var ExpressLiveResource = function (app) {
    if (!(this instanceof ExpressLiveResource)) {
        throw new Error("Constructor called as a function");
    }

    this._app = app;
    this._listeners = [];

    var self = this;
    this._app.use(function (req, res, next) { self.middleware(req, res, next); });
};

ExpressLiveResource.prototype._addLink = function (res, uri, rel) {
    var link = '<' + uri + '>; rel=' + rel;
    var origLink = res.get('Link');
    if (origLink) {
        res.set('Link', origLink + ', ' + link);
    } else {
        res.set('Link', link);
    }
};

ExpressLiveResource.prototype._addLinks = function (res, uri, host, secure) {
    this._addLink(res, uri, 'value-wait');
    var wsScheme = (secure ? 'wss' : 'ws');
    this._addLink(res, wsScheme + '://' + host + '/updates/', 'multiplex-ws');
};

ExpressLiveResource.prototype._canonicalUri = function (uri) {
    var parsed = url.parse(uri, false, true);
    return parsed.path;
};

// cb = function (code, headers, body)
ExpressLiveResource.prototype._internalRequest = function (method, uri, headers, cb) {
    console.log('internal request: ' + method + ' [' + uri + ']');
    var mreq = httpMocks.createRequest({
        method: method,
        url: uri,
        headers: headers
    });
    mreq.headers['internal'] = '1';
    mreq.get = function (name) {
        return mreq.headers[name];
    };
    var mres = httpMocks.createResponse();
    mres.set = function (name, value) {
        mres.setHeader(name, value);
    };
    mres.on('end', function () {
        console.log('internal request finished');
        cb(mres._getStatusCode(), mres._getHeaders(), mres._getData());
    });
    this._app(mreq, mres);
};

ExpressLiveResource.prototype.middleware = function (req, res, next) {
    if (req.get('internal')) {
        console.log('middleware: skipping internal request');
        next();
        return;
    }

    var self = this;
    var wait = req.get('Wait');
    if (wait) {
        var wait = parseInt(wait);
        if (isNaN(wait)) {
            res.send(400, 'Invalid Wait value\n');
            return;
        }
        var headers = {};
        for (var i in req.headers) {
            var li = i.toLowerCase();
            if (li == 'wait') {
                continue;
            } else if (li == 'if-none-match') {
                // FIXME: case sensitivity stuff
                headers['If-None-Match'] = req.headers[i];
            } else {
                headers[i] = req.headers[i];
            }
        }
        //console.log('middleware: url=' + req.url + ', inm=' + headers['If-None-Match']);
        this._internalRequest('GET', req.url, headers, function (code, headers, body) {
            if (code == 304) {
                console.log('waiting: ' + wait);
                var l = {res: res, uris: [req.url], host: req.get('Host'), secure: req.secure};
                self._listeners.push(l);
                req.on('close', function () {
                    console.log('client disconnected');
                    var i = self._listeners.indexOf(l);
                    self._listeners.splice(i, 1);
                });
                l.timer = setTimeout(function () {
                    var i = self._listeners.indexOf(l);
                    self._listeners.splice(i, 1);
                    console.log('timing out request');
                    for (var i in headers) {
                        res.set(i, headers[i]);
                    }
                    self._addLinks(res, req.url, req.get('Host'), req.secure);
                    res.status(304).send(body);
                }, wait * 1000);
            } else {
                for (var i in headers) {
                    res.set(i, headers[i]);
                }
                self._addLinks(res, req.url, req.get('Host'), req.secure);
                res.status(code).send(body);
            }
        });
        return;
    }

    var writeHead = res.writeHead;
    res.writeHead = function (code, headers) {
        var etag = res.get('ETag');
        if (etag) {
            self._addLinks(res, req.url, req.get('Host'), req.secure);
        }
        writeHead.call(this, code, headers);
    };
    next();
};

ExpressLiveResource.prototype.updated = function (uri) {
    var self = this;
    this._internalRequest('GET', uri, {}, function (code, headers, body) {
        var etag = headers['ETag']; // FIXME: case stuff?
        if (!etag) {
            console.log('object has no etag');
            return;
        }
        var value = null;
        try {
            value = JSON.parse(body);
        } catch (e) {
            console.log('object must have a json value');
            return;
        }
        console.log('there are ' + self._listeners.length + ' listeners');
        for (var i = 0; i < self._listeners.length; ++i) {
            var l = self._listeners[i];
            if (l.uris.indexOf(uri) != -1) {
                console.log('sending value to client');
                if (l.res) {
                    clearTimeout(l.timer);
                    self._listeners.splice(i, 1);
                    /*if (l.multi) {
                        var values = {};
                        values[id] = value;
                        sendMultiValue(l.res, values);
                    } else {*/
                        for (var i in headers) {
                            l.res.set(i, headers[i]);
                        }
                        self._addLinks(l.res, uri, l.host, l.secure);
                        l.res.status(200).json(value);
                    //}
                } else if (l.ws) {
                    var event = {type: 'event', uri: uri, headers: {ETag: etag}, body: value};
                    l.ws.send(JSON.stringify(event));
                }
            }
        }
    });
};

ExpressLiveResource.prototype.listenWebSocket = function (server) {
    var self = this;

    var wss = new WebSocketServer({
        server: server,
        path: '/updates/',
        handleProtocols: function (protocols, cb) {
            if (protocols && protocols.indexOf('liveresource') != -1) {
                cb(true, 'liveresource');
            } else {
                cb(true);
            }
        }
    });

    wss.on('connection', function (ws) {
        console.log('ws connection opened');

        // from WebSocketServer internals
        var trustClient = false;
        var secure = ((trustClient && ws.upgradeReq.headers['x-forwarded-proto'] === 'https') || ws._socket.encrypted);

        var l = {ws: ws, uris: [], host: ws.host, secure: secure};
        ws.on('close', function () {
            console.log('ws client disconnected');
            var i = self._listeners.indexOf(l);
            self._listeners.splice(i, 1);
        });
        ws.on('message', function (message) {
            console.log('received: ' + message);
            try {
                req = JSON.parse(message);
            } catch (e) {
                console.log('ws received invalid message');
                return;
            }

            // FIXME: resolve relative URLs against '/updates/' for correctness, before c14n
            var uri = self._canonicalUri(req.uri);
            if (!uri) {
                var resp = {id: req.id, type: 'error'};
                ws.send(JSON.stringify(resp));
                return;
            }

            if (req.type == 'subscribe') {
                l.uris.push(uri);
                console.log('ws subscribed to [' + uri + ']');
                var resp = {id: req.id, type: 'subscribed'};
                ws.send(JSON.stringify(resp));
            } else if (req.type == 'unsubscribe') {
                at = l.uris.indexOf(uri);
                if (at != -1) {
                    l.uris.splice(at, 1);
                }
                console.log('ws unsubscribed from [' + uri + ']');
                var resp = {id: req.id, type: 'unsubscribed'};
                ws.send(JSON.stringify(resp));
            }
            self._listeners.push(l);
        });
    });
};

exports.ExpressLiveResource = ExpressLiveResource;
