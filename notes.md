LiveResource Implementation Notes
=================================

Files are split into concerns as ES6 classes.

At the current time they are combined into a single standalone JavaScript file intended to be
loaded into a browser, using Browserify.

Building LiveResource
---------------------

LiveResource is built using Browserify.

It can be built using commands registered with `package.json`. These scripts can be invoked using
`npm run`.

To build the library, type `npm run build`. Output files will be genertaed in the `dist` directory.

Architecture
------------

LiveResource comprises a number of components that make up the library, each of which can be classified
into several categories and layers.

The heart of the system of the Engine class, which manages objects called Engine Units and Resource Handlers.

A Resource Handler is an abstraction of a resource that is managed by an instance of the Engine. The LiveResource 
component exists as an additional thin layer above the Resource Handler, and manages interaction with the library client
software, mainly in the form of event handling. By separating the two layers it is possible to associate multiple
LiveResource objects with a single Resource Handler that backs them, sharing the connections, polls, sockets, etc. that
are needed to manage a single resource.

Engine Units are sort of a plug-in to the Engine that contain code to handle and process the different interest types
(value, changes). 

