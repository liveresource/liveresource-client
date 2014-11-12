var express = require('express');
var ExpressLiveResource = require('express-liveresource').ExpressLiveResource;
var path = require('path');

// setup server

var app = express();
var server = app.listen(3000, function () {
    console.log('Listening on port %d', server.address().port);
});
var liveResource = new ExpressLiveResource(app);
liveResource.listenWebSocket(server);

app.use(function(req, res, next) {
   if(req.url.substr(-1) != '/') {
       res.redirect(301, req.url + '/');
   } else {
       next();
   }
});

// in-memory counter data

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

// front-end files

app.get('/', express.static(__dirname));
app.get('/liveresource.js', function(req, res) {
    var filePath = path.resolve(__dirname + '/../../build/output/liveresource-latest.js');
    res.sendfile(filePath);
});
app.get(/^\/.*\.js$/, express.static(__dirname + '/../common/client'));

// counter api

app.head('/counter/:id/', function (req, res) {
    var value = getCounter(req.params.id);
    var etag = '"' + value + '"';
    res.set('ETag', etag);
    res.send('')
});

app.get('/counter/:id/', function (req, res) {
    var value = getCounter(req.params.id);
    var etag = '"' + value + '"';
    res.set('ETag', etag);

    var inm = req.get('If-None-Match');
    if (inm == etag) {
        res.status(304).end();
    } else {
        res.status(200).json(value);
    }
});

app.post('/counter/:id/', function (req, res) {
    incCounter(req.params.id);
    liveResource.updated(req.url);
    res.send('Ok\n');
});
