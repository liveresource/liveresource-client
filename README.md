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

We all work with resources when developing web applications. What if we had a nice way to know when they change?

```javascript
var resource = new LiveResource('http://example.com/path/to/object');
resource.on('value', function (data) {
  // the resource's value has been initially retrieved or changed
});
```

What this will do is make a GET request to the specified resource URI to retrieve its value and to discover if the resource supports live updates (indicated via HTTP response headers). The `value` callback will be triggered once the initial value has been received. If the resource supports live updates, then the LiveResource library will begin listening for updates in the background and trigger the `value` callback again whenever the resource changes. If the resource does not support live updates, then `value` will be emitted only once.

LiveResource uses WebSockets and HTTP long-polling to receive updates in realtime. It differs from other realtime solutions by providing an interface modeled around synchronization rather than messaging or sockets. LiveResource is designed first and foremost as an open protocol (see `protocol.md`), to enable the possibility of many compatible client and server implementations. There is no official LiveResource server. Rather, any server application can be modified to speak the LiveResource protocol in order to be compatible with clients.

Server
------

Supporting live updates on the server is designed to be easy. If you're using Node.js and Express, you can use the `express-liveresource` package. Otherwise, see the `protocol.md` file for details.

For example, to enable live updates of an object resource using `express-liveresource`, make sure the resource supports ETags:

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

Credit
------

LiveResource is inspired by RealCrowd's API: http://code.realcrowd.com/restful-realtime/
