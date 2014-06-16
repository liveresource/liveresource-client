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

LiveResource uses WebSockets and HTTP long-polling to receive updates in realtime. It differs from other realtime solutions by providing an interface modeled around synchronization rather than messaging or sockets. LiveResource is designed first and foremost as an open protocol, to enable the possibility of many compatible client and server implementations. There is no official LiveResource server. Rather, any server application can be modified to speak the LiveResource protocol in order to be compatible with clients.

Server
------

Supporting live updates on the server is designed to be easy. If you're using Node.js and Express, you can use the `express-liveresource` package. Otherwise, you can look for other libraries or implement the protocol directly (see the Protocol section).

For example, to enable live updates of an object resource, make sure the resource supports ETags:

```javascript
var ExpressLiveResource = require('express-liveresource').ExpressLiveResource;
var liveresource = new ExpressLiveResource(app);

app.get('/path/to/object', function (req, res) {
    var value = ... object value ...
    var etag = '"' + ... object hash ... + '"';
    res.set('ETag', etag);

    var inm = req.get('If-None-Match');
    if (inm == etag) {
        res.send(304);
    } else {
        res.status(200).json(value);
    }
});
```

Then, whenever the object has been updated, call:

```javascript
liveresource.updated('/path/to/object');
```

Protocol
--------

(Note: For full protocol details, see the the `protocol.md` file.)

Resources indicate support for live updates via `Link` headers in their HTTP responses. The simplest live updates mechanism is HTTP long-polling, using a rel type of `value-wait`.

For example, suppose a client fetches a resource:

```
GET /path/to/object HTTP/1.1
...
```

The server can indicate support for live updates by including a `Link` header in the response:

```
HTTP/1.1 200 OK
ETag: "b1946ac9"
Link: </path/to/object>; rel=value-wait
...
```

The `value-wait` link means that the client can perform a long-polling request for the object's value. This is done by supplying a `Wait` header in the request, along with `If-None-Match` to check against the object's ETag:

```
GET /object HTTP/1.1
If-None-Match: "b1946ac9"
Wait: 60
...
```

If the data changes while the request is open, then the new data is returned immediately:

```
HTTP/1.1 200 OK
ETag: "2492d234"
Link: </path/to/object>; rel=value-wait
...
```

If the data does not change for the duration of time specified in the `Wait` header, then a 304 is eventually returned:

```
HTTP/1.1 304 Not Modified
ETag: "b1946ac9"
Link: </path/to/object>; rel=value-wait
Content-Length: 0
```

What's nice about LiveResource's long-polling mechanism is that it is simple and stateless. There are no sessions nor hacky stream-over-HTTP emulations.

Beyond this basic overview, the LiveResource protocol also supports collection resources as well as WebSocket and Webhook live updates mechanisms. See the the `protocol.md` file for complete details.

Credit
------

LiveResource was inspired by RealCrowd's API: http://code.realcrowd.com/restful-realtime/
