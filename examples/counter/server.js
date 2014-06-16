var express = require('express');
var ExpressLiveResource = require('./express-liveresource').ExpressLiveResource;

var app = express();
var liveresource = new ExpressLiveResource(app);

var counters = {};

var getCounter = function (id) {
    var value = counters[id];
    if (value == null) {
        value = 0;
    }
    return value;
};

var incCounter = function (id) {
    var value = counters[id];
    if (value == null) {
        value = 0;
    }
    ++value;
    counters[id] = value;
    return value;
};

app.get('/', function (req, res) {
    res.sendfile('index.html');
});

app.get(/^\/(.*\.js)$/, function (req, res) {
    if (req.params[0].indexOf('..') != -1) {
        res.send(403, 'Forbidden');
        return;
    }

    var fileName = req.params[0];
    var root = null;
    if (fileName == 'liveresource.js') {
        root = '../..';
    } else {
        root = '../common/client';
    }

    res.sendfile(fileName, {root: root});
});

app.head('/counter/:id/', function (req, res) {
    var value = getCounter(req.params.id);
    res.set('ETag', '"' + value + '"');
    res.send('')
});

app.get('/counter/:id/', function (req, res) {
    var value = getCounter(req.params.id);
    var etag = '"' + value + '"';
    res.set('ETag', etag);

    var inm = req.get('If-None-Match');
    if (inm == etag) {
        res.send(304);
    } else {
        res.status(200).json(value);
    }
});

app.post('/counter/:id/', function (req, res) {
    incCounter(req.params.id);
    liveresource.updated(req.url);
    res.send('Ok\n');
});

var server = app.listen(3000, function () {
    console.log('Listening on port %d', server.address().port);
});
liveresource.listenWebSocket(server);
