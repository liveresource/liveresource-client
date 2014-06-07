LiveResource
============
Date: June 6th, 2014

Authors:
  * Justin Karneges <justin@fanout.io>
  * Katsuyuki Ohmuro <harmony7@pex2.jp>

Mailing List: http://lists.fanout.io/listinfo.cgi/fanout-users-fanout.io

LiveResource is a JavaScript library and protocol specification for receiving live updates of RESTful resources.

License
-------

LiveResource is offered under the MIT license. See the COPYING file.

Dependencies
------------

  * json2.js
  * Pollymer
  * WebSockHop

Usage
-----

We all work with RESTful resources when developing web applications. What if we had a nice way to know when resources have changed?

```javascript
var resource = new LiveResource('http://example.com/path/to/object');
resource.on('value', function (data) {
  // the resource's value has been initially retrieved or changed
});
```

LiveResource supports two kinds of resources: objects and collections. An object has a single value, where an update wholly replaces the previous value. A collection resource, on the other hand, contains a set of child objects, and updates indicate when child objects are added, updated, or removed.

Here's how you might work with a collection:

```javascript
var chatlog = new LiveResource('/room/1/items/');
chatlog.on('ready', function() {
  $.get('/room/1/items/?limit=100', function (items) {
    // render the most recent items
    ...
  }, 'json');
});
chatlog.on('child-added', function (item) {
  // got a new item
});
```

Unlike object resources, collection resources don't have an initial value. It's your job to retrieve any initial state. Use the 'ready' callback to know when LiveResource is successfully listening for updates on the collection, as you'll want to wait for that before fetching initial state. Here we use jquery to perform a filtered request on the same resource being monitored for updates.

LiveResource differs from other realtime solutions by providing an interface modeled around synchronization rather than messaging or "sockets". The underlying protocol is also HTTP-centric. For example, even though LiveResource is able to use WebSockets to receive updates in realtime, the initial value of an object resource is always retrieved via an HTTP GET. The result is a melding of protocols that works with the strengths of each.

Server
------

Of course, for any of this to work, the server needs to understand the LiveResource protocol. The protocol has been designed to be easy to understand and implement. See the full spec in the `protocol.md` file. There is no "official" server for LiveResource, but we hope that libraries can be created for each language and web framework to ease implementation.

If you're using Node.js and Express, you can use the `express-liveresource` package to easily realtimify your REST API.

For example, to enable live updates of an object resource, make sure it supports ETags:

```javascript
var LiveResource = require('express-liveresource');
var liveresource = LiveResource(app);

app.get('/path/to/object', function (req, res) {
    var value = ... object value ...
    var etag = '"' + ... object hash ... + '"';
    res.set('ETag', etag);

    var inm = req.get('If-None-Match');
    if (inm == etag) {
        res.send(304);
    } else {
        res.json(value);
    }
});
```

Then, whenever the object has been updated, call:

```javascript
liveresource.updated('/path/to/object');
```

Essentially what happens under the hood here is `updated()` will perform an internal GET request against the named resource URI, and then push that value out to any listening clients.

Credit
------

LiveResource is inspired by RealCrowd's API: http://code.realcrowd.com/restful-realtime/
