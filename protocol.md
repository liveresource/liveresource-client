LiveResource Protocol
=====================

Many web services are built using RESTful design patterns surrounding objects and collections, and front-end developers are comfortable working with these kinds of services. What if we just had a way to notify when objects/collections were updated?

This document describes a realtime updates protocol based around web resources. Resources indicate support for realtime updates using Link headers in HTTP responses. For example:

    GET /resource HTTP/1.1
    ...

    HTTP/1.1 200 OK
    Link: </resource>; rel="value-wait value-stream"
    Link: </resource/subscription/>; rel=value-callback
    ...

This information can also be obtained with the HEAD method, if you want to see what a resource supports without receiving its content.

There are two notification types ("value" and "changes") and three notification mechanisms ("wait", "stream", and "callback"). As a result, the following link relations are defined based on the various possible combinations:

Link rel             | Meaning
-------------------- | ----------------------------------------------------------------------------------------------------
value-wait           | Long-polling updates of a resource's entire value
value-stream         | Server-sent events (SSE) updates of a resource's entire value
value-callback       | Base URI for subscription management of HTTP callback (webhook) updates of a resource's entire value
changes              | Immediate updates of a collection's children
changes-wait         | Long-polling updates of a collection's children
changes-stream       | Server-sent events (SSE) updates of a collection's children
changes-callback     | Base URI for subscription management of HTTP callback (webhook) updates of a collection's children

The "changes" link type is an outlier, used to poll a collection resource for changes immediately without any deferred response behavior. A similar link type is not needed for "value" polling since this is assumed to be possible with a plain GET on the resource.

Additionally, there are link types for multiplexing:

Link rel             | Meaning
-------------------- | ----------------------------------------------------------------------------------------------------
multiplex-wait       | Base URI for accessing multiple resources in a single request, with support for long-polling
multiplex-stream     | Base URI for accessing multiple resources via a single server-sent events (SSE) stream
multiplex-ws         | Base URI for accessing multiple resources via a single WebSocket connection

Below, we'll go over how the long-polling mechanisms can be used with common web objects and collections.

Objects
-------

Object resources may announce support for updates via long-polling by including an ETag and appropriate Link header:

    GET /object HTTP/1.1
    ...

    HTTP/1.1 200 OK
    ETag: "b1946ac9"
    Link: </object>; rel=value-wait
    ...

To make use of the value-wait link, the client issues a GET to the linked URI with the If-None-Match header set to the value of the received ETag. The client also provides the Wait header with a timeout value in seconds.

    GET /object HTTP/1.1
    If-None-Match: "b1946ac9"
    Wait: 60
    ...

If the data changes while the request is open, then the new data is returned:

    HTTP/1.1 200 OK
    ETag: "2492d234"
    Link: </object>; rel=value-wait
    ...

If the data does not change, then a 304 is returned:

    HTTP/1.1 304 Not Modified
    ETag: "b1946ac9"
    Link: </object>; rel=value-wait
    Content-Length: 0

If the object is deleted while the request is open, then a 404 is returned:

    HTTP/1.1 404 Not Found
    ...

Collections
-----------

Like objects, collection resources announce support via Link headers:

    GET /collection/ HTTP/1.1
    ...

    HTTP/1.1 200 OK
    Link: </collection/?after=1395174448&max=50>; rel="changes changes-wait"
    ...

Unlike objects which use ETags, collections encode a checkpoint in the provided "changes" and/or "changes-wait" URIs. The client should request against these URIs to receive updates to the collection. The changes-wait URI is used for long-polling.

Collection resources always return items in the collection. The changes URIs should return all items that were modified after some recent checkpoint (such as the current time). If there are items, they should be returned with code 200. If there are no such items, an empty list should be returned.

The changes URIs MAY have a limited validity period. If the server considers a URI too old to process, it can return 404, which should signal the client to start over and obtain fresh changes URIs.

For realtime updates, the client provides a Wait header to make the request act as a long poll:

    GET /collection/?after=1395174448&max=50 HTTP/1.1
    Wait: 60
    ...

Any request can be made against the collection to receive a changes URIs. For example, a news feed may want to obtain the most recent N news items and be notified of updates going forward. To accomplish this, the client could make a request to a collection resource of news items, perhaps with certain query parameters indicating an "order by created_time desc limit N" effect. The client would then receive these items and use them for initial display. The response to this request would also contain changes URIs though, which the client could then begin long-polling against to receive any changes.

This spec does not dictate the format of a collections response, but it does make the following requirements: 1) Elements in a collection MUST have an id value somewhere, that if concatenated with the collection resource would produce a direct link to the object it represents, and 2) Elements in a collection SHOULD have a deleted flag, to support checking for deletions. Clients must be able to understand the format of the collections they interact with, and be able to determine the id or deleted state of any such items.

Webhooks
--------

A resource can indicate support for update notifications via callback by including a "callback" Link type:

    GET /object HTTP/1.1
    ...

    HTTP/1.1 200 OK
    ETag: "b1946ac9"
    Link: </object/subscription/>; rel=value-callback
    ...

The link points to a collection resource that manages callback URI registrations. The behavior of this endpoint follows the outline at http://resthooks.org/

To subscribe http://example.org/receiver/ to a resource:

    POST /object/subscription/ HTTP/1.1
    Content-Type: application/x-www-form-urlencoded

    callback_uri=http:%2F%2Fexample.org%2Freceiver%2F

Server responds:

    HTTP/1.1 201 Created
    Location: http://example.com/object/subscription/http:%2F%2Fexample.org%2Freceiver%2F
    Content-Length: 0

The subscription's id will be the encoded URI that was subscribed. To unsubscribe, delete the subscription's resource URI:

    DELETE /object/subscription/http:%2F%2Fexample.org%2Freceiver%2F HTTP/1.1

Update notifications are delivered via HTTP POST to each subscriber URI. The Location header is set to the value of the resource that was subscribed to. For example:

    POST /receiver/ HTTP/1.1
    Location: http://example.com/object
    ...

In the case of object resources, the body of the POST request contains the entire object value. If the object was deleted, then an empty body is sent.

For collection resources, the POST request body contains the response that would normally have been sent to a request for the changes URI. The request should also contain two Link headers, with rel=changes and rel=prev-changes. The recipient can compare the currently known changes link with the prev-changes link to ensure a callback was not missed. If it was, the client can resync by performing a GET against the currently known changes link.

Server-Sent Events
------------------

A resource can indicate support for notifications via Server-Sent Events by including a "stream" Link type:

    GET /object HTTP/1.1
    ...

    HTTP/1.1 200 OK
    ETag: "b1946ac9"
    Link: </object/stream/>; rel=value-stream
    ...

The link points to a Server-Sent Events capable endpoint that streams updates related to the resource. The client can then access the stream:

    GET /object/stream/ HTTP/1.1
    ...

    HTTP/1.1 200 OK
    Content-Type: text/event-stream
    ...

Event ids should be used to allow recovery after disconnect. For example, an object resource might use ETags for event ids. Events are not named. For value-stream URIs, each event is a JSON value of the object itself, or an empty string if the object was deleted. For changes-stream URIs, each event is a JSON object of the same format that is normally returned when retrieving elements from the collection (e.g. a JSON list).

Multiplexing
------------

In order to reduce the number of needed TCP connections in client applications, servers may support multiplexing many long-polling requests or Server-Sent Events connections together. This is indicated by providing Links of type "multiplex-wait" and/or "multiplex-stream". For example, suppose there are two object URIs of interest:

    GET /objectA HTTP/1.1
    ...

    HTTP/1.1 200 OK
    ETag: "b1946ac9"
    Link: </objectA>; rel=value-wait
    Link: </multi/>; rel=multiplex-wait
    ...

    GET /objectB HTTP/1.1
    ...

    HTTP/1.1 200 OK
    ETag: "d3b07384"
    Link: </objectB>; rel=value-wait
    Link: </multi/>; rel=multiplex-wait
    ...

The client can detect that both of these objects are accessible via the same multiplex endpoint "/multi/". Both resources can then be checked for updates in a single long-polling request. This is done by passing each resource URI as a query parameter named "u". Each "u" param should be immediately followed by an "inm" param (meaning If-None-Match) to specify the ETag to check against for the preceding URI. Collection resources do not use a inm param, since the checkpoint is encoded in the URI itself.

    GET /multi/?u=%2FobjectA&inm="b1946ac9"&u=%2FobjectB&inm="d3b07384" HTTP/1.1
    Wait: 60
    ...

The multiplex response uses a special format of a JSON object, where each child member is named for a URI that has response data. For example:

    HTTP/1.1 200 OK
    Content-Type: application/liveresource-multiplex

    {
      "/objectA": {
        "code": 200,
        "headers": {
          "ETag": "\"2492d234\""
        },
        "body": { "foo": "bar" }
      }
    }

If the request is a long-polling request and only one URI has response data, then response data for the others should not be included.

Multiplexing SSE is also possible:

    GET /multi/?u=%2FobjectA&u=%2FobjectB HTTP/1.1
    Accept: text/event-stream
    ...

In this case, each message is encapsulated in a JSON object, with "uri" and "body" fields. The "uri" field contains the URI that the message is for. The "body" field contains a JSON-parsed value of what would normally have been sent over a non-multiplexed SSE connection. If the value is empty, then "body" should be set to null or not included.

WebSockets
----------

A resource can indicate support for notifications via WebSocket by including a "multiplex-ws" Link type:

    GET /object HTTP/1.1
    ...

    HTTP/1.1 200 OK
    ETag: "b1946ac9"
    Link: </updates/>; rel=multiplex-ws
    ...

The link points to a WebSocket capable endpoint. The client can then connect to establish a bi-directional session for handling subscriptions to resources and receiving notifications about them. The client and server must negotiate the "liveresource" protocol using Sec-WebSocket-Protocol headers. The wire protocol uses JSON-formatted messages.

Once connected, the client can subscribe to a resource:

    { "id": "1", "type": "subscribe", "mode": "value", "uri": "/objectA" }

Server acks:

    { "id": "1", "type": "subscribed" }

The client can also unsubscribe:

    { "id": "2", "type": "unsubscribe", "mode": "value", "uri": "/objectA" }

Server acks:

    { "id": "2", "type": "unsubscribed" }

The 'id' field is used to match up requests and responses. The client does not have to wait for a response in order to make more requests over the socket. The server is not required to respond to requests in order. Subscriptions can have mode "value" or "changes". More than one subscription can be established over a single connection.

The server notifies the client by sending a message of type "event". For values:

    {
      "type": "event",
      "uri": "/objectA",
      "headers": {
        "ETag": "..."
      },
      "body": { ... }
    }

For changes:

    {
      "type": "event",
      "uri": "/collection/",
      "headers": {
        "Link": "</collection/?after=1395174448>; rel=changes, </collection/?after=1395174448>; rel=prev-changes",
      },
      "body": [ ... ]
    }

Notifications do not have guaranteed delivery. The client can detect for errors and recover by fetching the original URI or the changes URI.

JavaScript API
--------------

It should be possible to create a simple JavaScript API that supports fetching and syncing against web resources that conform to the above spec.

Example usage for objects:

    // get and listen for updates of a user profile resource
    var user = new LiveResource('http://example.com/users/justin');

    user.on('value', function(data) {
      // the content of the 'justin' resource has been initially received or changed
    });

    user.on('removed', function() {
      // the 'justin' resource has been removed
    });

Example usage for collections:

    // fetch the first 20 items in justin's contact list ordered by first name.
    //   this will also return an updates URI for the resource, which will be
    //   utilized in the background to listen for updates going forward
    var contacts = new LiveResource(
      'http://example.com/users/justin/contacts/?order=first&max=20'
    );

    contacts.on('child-added', function(item) {
      // an item was created, with uri {contacts.uri}/{item.id}/
    });

    contacts.on('child-changed', function(item) {
      // an item was changed, with uri {contacts.uri}/{item.id}/
    });

    contacts.on('child-removed', function(item_id) {
      // an item was removed, with uri {contacts.uri}/{item_id}/
    });

    // if there was other metadata in the response that would be useful out of band,
    //   then it can be obtained through the object. e.g. contacts.initialRequest.responseHeaders
    //   could be used to fish out a Link rel=next for paging to the next 20 items
    //   of the contact list ordered by first name.

    // if the app already has the updates link to use and doesn't want the JS API to
    //   perform any initial query, it can be specified directly. for example, this could
    //   happen if the app already accessed the collection using some separate AJAX
    //   calls, or if the updates URI was written directly into the HTML by the server
    //   when serving the page.
    var contacts = new LiveResource({
        'updates': 'http://example.com/users/justin/contacts/?after=1395174448&max=50'
    });

The JavaScript API implementation could start by using long-polling for updates and then attempt an upgrade to Server-Sent Events for compatible browsers.
