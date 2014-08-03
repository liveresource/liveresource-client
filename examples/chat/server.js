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

var changesLink = function (room, pos) {
    return '</chat/' + room.id + '/messages/?after=' + pos + '>; rel=changes';
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

    res.set('Link', changesLink(room, changesPos));
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
