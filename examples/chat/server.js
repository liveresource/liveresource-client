var express = require('express');
var bodyParser = require('body-parser');
var ExpressLiveResource = require('express-liveresource').ExpressLiveResource;
var path = require('path');
var url = require('url');

// setup server

var app = express();
var server = app.listen(3000, function () {
    console.log('Listening on port %d', server.address().port);
});
app.use(bodyParser.urlencoded({extended: false}));
var liveResource = new ExpressLiveResource(app);
liveResource.listenWebSocket(server);

app.use(function(req, res, next) {
   u = url.parse(req.url)
   if(u.pathname.substr(-3) != '.js' && u.pathname.substr(-4) != '.map' && u.pathname.substr(-1) != '/') {
       u.pathname += '/';
       res.redirect(301, url.format(u));
   } else {
       next();
   }
});

// in-memory chat data

var rooms = {};

var roomGetOrCreate = function (id) {
    var room = rooms[id];
    if (room == null) {
        room = {id: id, messages: []};
        rooms[id] = room;
    }
    return room;
};

var roomAppendMessage = function (room, from, text) {
    room.messages.push({from: from, text: text});
};

var roomGetMessagesAfter = function (room, pos, limit) {
    var out = [];
    for (var n = pos + 1; n < room.messages.length && out.length < limit; ++n) {
        out.push(room.messages[n]);
    }
    return out;
};

var roomGetMessagesBefore = function (room, pos, limit) {
    var out = [];
    for (var n = pos - 1; n >= 0 && out.length < limit; --n) {
        out.push(room.messages[n]);
    }
    return out;
};

// front-end files

app.get('/', express.static(__dirname));
app.get('/liveresource.js', function(req, res) {
    var filePath = path.resolve(__dirname + '/../../dist/liveresource.js');
    res.sendFile(filePath);
});
app.get('/liveresource.js.map', function(req, res) {
    var filePath = path.resolve(__dirname + '/../../dist/liveresource.js.map');
    res.sendFile(filePath);
});
app.get(/^\/.*\.js(.map)?$/, express.static(__dirname + '/../common/client'));

// chat api

var changesLink = function (room, pos) {
    return '/chat/' + room.id + '/message/?after=' + pos;
};

var changesLinkHeader = function (room, pos) {
    return '<' + changesLink(room, pos) + '>; rel=changes';
};

app.head('/chat/:id/message/', function (req, res) {
    var room = roomGetOrCreate(req.params.id);
    res.set('Link', changesLinkHeader(room, room.messages.length));
    res.send('')
});

app.get('/chat/:id/message/', function (req, res) {
    var room = roomGetOrCreate(req.params.id);

    var limit = req.param('limit');
    if (limit != null) {
        limit = parseInt(limit);
    } else {
        limit = 50;
    }

    var after = req.param('after');
    if (after != null) {
        after = parseInt(after);
    }

    var messages = null;
    var changesPos = null;
    if (after != null) {
        if (after < 0 || after > room.messages.length) {
            res.status(404).end();
            return;
        }
        messages = roomGetMessagesAfter(room, after - 1, limit);
        changesPos = after + messages.length;
    } else {
        messages = roomGetMessagesBefore(room, room.messages.length, limit);
        changesPos = room.messages.length;
    }

    res.set('Link', changesLinkHeader(room, changesPos));
    res.status(200).json(messages);
});

app.post('/chat/:id/message/', function (req, res) {
    var room = roomGetOrCreate(req.params.id);
    var prevChangesLink = changesLink(room, room.messages.length);

    roomAppendMessage(room, req.body.from, req.body.text);

    liveResource.updated(req.url, {
        prevChangesLink: prevChangesLink,
        query: {limit: '1'},
        getItems: function (body) { return body; }
    });

    res.send('Ok\n');
});
