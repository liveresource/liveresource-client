var express = require('express');
var bodyParser = require('body-parser');
var ExpressLiveResource = require('../common/server/express-liveresource').ExpressLiveResource;

// setup server

var app = express();
var server = app.listen(3000, function () {
    console.log('Listening on port %d', server.address().port);
});
app.use(bodyParser.urlencoded({extended: false}));
var liveResource = new ExpressLiveResource(app);
liveResource.listenWebSocket(server);

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
app.get('/liveresource.js', express.static(__dirname + '/../..'));
app.get(/^\/.*\.js$/, express.static(__dirname + '/../common/client'));

// chat api

var changesLink = function (room) {
    return '/chat/' + room.id + '/messages/?after=' + room.messages.length;
};

app.head('/chat/:id/message/', function (req, res) {
    var room = roomGetOrCreate(req.params.id);
    res.set('Link', '<' + changesLink(room) + '>; rel=changes');
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
        after = parseInt(after) - 1;
    }

    var messages = null;
    if (after != null) {
        messages = roomGetMessagesAfter(room, after, limit);
    } else {
        messages = roomGetMessagesBefore(room, room.messages.length, limit);
    }

    res.set('Link', '<' + changesLink(room) + '>; rel=changes');
    res.status(200).json(messages);
});

app.post('/chat/:id/message/', function (req, res) {
    var room = roomGetOrCreate(req.params.id);
    roomAppendMessage(room, req.param('from'), req.param('text'));
    liveResource.updated(req.url);
    res.send('Ok\n');
});
