LiveResource
============
Date: June 6th, 2014

Authors:
  * Justin Karneges <justin@fanout.io>
  * Katsuyuki Ohmuro <harmony7@pex2.jp>

Mailing List: http://lists.fanout.io/listinfo.cgi/fanout-users-fanout.io

We all work with RESTful resources when developing web applications. What if we had a nice way to know when resources have changed?

```javascript
var resource = new LiveResource('http://example.com/path/to/object');
resource.on('value', function (data) {
  // the resource's value has been initially retrieved or changed
});
```

LiveResource supports the notion of two kinds of resources: objects and collections. An object has a single value, and an update completely replaces the original value. A collection resource contains a set of child objects, and updates indicate when child objects are added, updated, or removed.

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

Unlike object resources, collection resources don't have an initial value. It's on you to fetch any needed initial state. Use the 'ready' callback to know when LiveResource is successfully listening for updates on the collection, as you'll want to wait for that before fetching initial state. Here we just use jquery to perform a filtered request on the same resource being monitored for updates.

LiveResource differs from other "realtime" solutions by providing an interface modeled around synchronization rather than messaging or "sockets". The underlying protocol is also very HTTP-centric. For example, LiveResource is able to use WebSockets for receiving updates in realtime, but the initial value of an object resource is always retrieved via an HTTP GET. The result is a melding of protocols that is easy to understand.

Of course, for this to work, the server needs to understand the LiveResource protocol. The protocol has been designed to be easy to understand and implement. See the full spec in the `protocol.md` file.

License
-------

LiveResource is offered under the MIT license. See the COPYING file.

Dependencies
------------

  * json2.js
  * Pollymer
  * WebSockHop
