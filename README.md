LiveResource
============
Authors: Justin Karneges <justin@fanout.io>, Katsuyuki Ohmuro <harmony7@pex2.jp>  
Mailing List: http://lists.fanout.io/mailman/listinfo/fanout-users

LiveResource is a JavaScript library and protocol specification for receiving live updates of web resources.

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

We all work with web resources. What if we had a nice way to know when they change?

```javascript
var resource = new LiveResource('http://example.com/path/to/object');
resource.on('value', function (data) {
  // the resource's value has been initially retrieved or changed
});
```

The above code will make a GET request to the specified resource URI to retrieve its value and to discover if it supports live updates. The `value` callback will be triggered once the initial value has been received. If the resource supports live updates, then the LiveResource library will begin listening for updates and trigger the `value` callback again whenever the resource changes. If the resource does not support live updates, then `value` will be emitted only once. Think of this code like a fancy AJAX request, with automatic realtime updates capability.

LiveResource uses WebSockets and HTTP long-polling to receive updates in realtime. It differs from other realtime solutions by providing an interface modeled around synchronization rather than messaging or sockets.

Server
------

There is no official LiveResource server. Rather, any server application can be modified to speak the LiveResource protocol in order to be compatible with clients.

If you're using Node.js and Express, you can use the `express-liveresource` package to easily realtimify your REST endpoints in just a few lines of code. Otherwise, you can look for other libraries or implement the protocol directly (see the Protocol section).

For example, to enable live updates of an object resource, first make sure the resource supports ETags:

```javascript
app.get('/path/to/object', function (req, res) {
    var value = ... object value ...
    var etag = '"' + ... object hash ... + '"';
    res.set('ETag', etag);

    var inm = req.get('If-None-Match');
    if (inm == etag) {
        res.status(304).end();
    } else {
        res.status(200).json(value);
    }
});
```

Initialize the LiveResource subsystem as part of your server startup:

```javascript
var ExpressLiveResource = require('express-liveresource').ExpressLiveResource;
var liveResource = new ExpressLiveResource(app);
```

Then, whenever the object has been updated, call:

```javascript
liveResource.updated('/path/to/object');
```

Examples
--------

To run the simple counter example:

```sh
cd examples/counter
npm i
npm start
```

Then open a browser to http://localhost:3000/

Protocol
--------

LiveResource is designed first and foremost as an open protocol, to enable the possibility of many compatible client and server implementations. For full protocol details, see the the `protocol.md` file.

Resources indicate support for live updates via `Link` headers in their HTTP responses. The simplest live updates mechanism is HTTP long-polling, using a rel type of `value-wait`.

For example, suppose a client fetches a resource:

```
GET /path/to/object HTTP/1.1
```

The server can indicate support for live updates by including a `Link` header in the response:

```
HTTP/1.1 200 OK
ETag: "b1946ac9"
Link: </path/to/object>; rel=value-wait
Content-Type: application/json

{"foo": "bar"}
```

The `value-wait` link means that the client can perform a long-polling request for the object's value. This is done by supplying a `Wait` header in the request, along with `If-None-Match` to check against the object's ETag:

```
GET /path/to/object HTTP/1.1
If-None-Match: "b1946ac9"
Wait: 60
```

If the data changes while the request is open, then the new data is returned immediately:

```
HTTP/1.1 200 OK
ETag: "2492d234"
Link: </path/to/object>; rel=value-wait
Content-Type: application/json

{"foo": "baz"}
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
