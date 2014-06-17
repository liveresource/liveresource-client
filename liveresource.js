/**
 * LiveResource JavaScript Library v0.1.0
 * Copyright 2014 Fanout, Inc.
 * Released under the MIT license (see COPYING file in source distribution)
 */
(function(factory) {
    "use strict";
    var DEBUG = true;
    var isWindow = function(variable) {
        return variable && variable.document && variable.location && variable.alert && variable.setInterval;
    }
    if (!isWindow(window)) {
        throw "The current version of LiveResource may only be used within the context of a browser.";
    }
    var debugMode = DEBUG && typeof(window.console) !== "undefined";
    if (typeof define === 'function' && define['amd']) {
        // AMD anonymous module
        define(['module', 'websockhop'], function(module, websockhop) { module.exports = factory(window, websockhop, debugMode); });
    } else {
        // No module loader (plain <script> tag) - put directly in global namespace
        if (!('WebSockHop' in window)) {
            throw "Require WebSockHop";
        }
        window['LiveResource'] = factory(window, window.WebSockHop, debugMode);
    }
})(function(window, WebSockHop, debugMode) {

    var debug;

    if (debugMode) {
        if (Function.prototype.bind) {
            debug = {
                log: window.console.log.bind(window.console),
                error: window.console.error.bind(window.console),
                info: window.console.info.bind(window.console),
                warn: window.console.warn.bind(window.console)
            };
        } else {
            var log = function(output) { window.console.log(output); };

            debug = {
                log: log,
                error: log,
                warn: log,
                info: log
            }
        }
    } else {
        var __no_op = function() {};

        debug = {
            log: __no_op,
            error: __no_op,
            warn: __no_op,
            info: __no_op
        }
    }

    var copyArray = function (array) {
        var args = Array.prototype.slice.call(arguments, 1);
        return Array.prototype.slice.apply(array, args);
    };

    var indexOfItemInArray = function (array, item) {
        for (var i = 0, length = array.length; i < length; i++) {
            if (array[i] === item) {
                return i;
            }
        }
        return -1;
    };

    var removeFromArray = function (array, item) {
        var again = true;
        while (again) {
            var index = indexOfItemInArray(array, item);
            if (index != -1) {
                array.splice(index, 1);
            } else {
                again = false;
            }
        }
    };

    var Events = function () {
        this._events = {};
    };
    Events.prototype._getHandlersForType = function (type) {
        if (!(type in this._events)) {
            this._events[type] = [];
        }
        return this._events[type];
    };
    Events.prototype.on = function (type, handler) {
        var handlers = this._getHandlersForType(type);
        handlers.push(handler);
    };
    Events.prototype.off = function (type) {
        if (arguments.length > 1) {
            var handler = arguments[1];
            var handlers = this._getHandlersForType(type);
            removeFromArray(handlers, handler);
        } else {
            delete this._events[type];
        }
    };
    Events.prototype.trigger = function (type, obj) {
        var args = copyArray(arguments, 2);
        var handlers = copyArray(this._getHandlersForType(type));
        for (var i = 0, n = handlers.length; i < n; i++) {
            var handler = handlers[i];
            handler.apply(obj, args);
        }
    };

    // Takes an object and a predicate.
    // Iterates all keys directly defined on the object
    // (not through prototype chain) and calls predicate
    // with key and value. Also, if predicate returns false,
    // break out of the loop.
    var forEachOwnKeyValue = function(obj, predicate, ctx) {
        for(var key in obj) {
            if (obj.hasOwnProperty(key)) {
                var result = predicate.call(ctx, key, obj[key]);
                if (typeof(result) != 'undefined' && !result) {
                    break;
                }
            }
        }
    };

    var getOrCreateKey = function(obj, key, defaultValue) {
        if (!(key in obj)) {
            obj[key] = defaultValue;
        }
        return obj[key];
    };

    var toAbsoluteUri = function(base, href) {

        function parseURI(url) {
            var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
            // authority = '//' + user + ':' + pass '@' + hostname + ':' port
            return (m ? {
                href     : m[0] || '',
                protocol : m[1] || '',
                authority: m[2] || '',
                host     : m[3] || '',
                hostname : m[4] || '',
                port     : m[5] || '',
                pathname : m[6] || '',
                search   : m[7] || '',
                hash     : m[8] || ''
            } : null);
        }

        function absolutizeURI(base, href) {// RFC 3986

            function removeDotSegments(input) {
                var output = [];
                input.replace(/^(\.\.?(\/|$))+/, '')
                    .replace(/\/(\.(\/|$))+/g, '/')
                    .replace(/\/\.\.$/, '/../')
                    .replace(/\/?[^\/]*/g, function (p) {
                        if (p === '/..') {
                            output.pop();
                        } else {
                            output.push(p);
                        }
                    });
                return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
            }

            href = parseURI(href || '');
            base = parseURI(base || '');

            return !href || !base ? null : (href.protocol || base.protocol) +
                (href.protocol || href.authority ? href.authority : base.authority) +
                removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
                (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
                href.hash;
        }

        // debug.info("toAbsoluteUri: base = '" + base + "', href = '" + href + "'");
        var uri = absolutizeURI(base, href);
        // debug.info("toAbsoluteUri: result = '" + uri + "'");
        return uri;
    };

    // TODO: REFACTOR THIS
    // ** PARSE LINK HEADER **
    // returns object with structure:
    //   { reltype1: { href: url, otherparam1: val }, reltype2: { ... } }
    // or return null if parse fails
    var parseLinkHeader = function (header) {
        if (header.length == 0)
            return null;

        var links = {};

        var at = 0;
        var readLink = true;
        while (readLink) {
            // skip ahead to next non-space char
            for (; at < header.length; ++at) {
                if (header[at] != ' ')
                    break;
            }
            if (at >= header.length || header[at] != '<')
                return null;

            var start = at + 1;
            var end = header.indexOf('>', at);
            if (end == -1)
                return null;

            var url = header.substring(start, end);

            at = end + 1;

            readLink = false;
            var readParams = false;
            if (at < header.length) {
                if (header[at] == ',') {
                    readLink = true;
                    ++at;
                } else if (header[at] == ';') {
                    readParams = true;
                    ++at;
                } else {
                    return null;
                }
            }

            var rel = null;
            var params = {};
            while (readParams) {
                // skip ahead to next non-space char
                for (; at < header.length; ++at) {
                    if (header[at] != ' ')
                        break;
                }
                if (at >= header.length)
                    return null;

                start = at;

                // find end of param name
                for (; at < header.length; ++at) {
                    if (header[at] == '=' || header[at] == ',' || header[at] == ';')
                        break;
                }
                end = at;

                var name = header.substring(start, end);
                var val = null;

                if (at < header.length && header[at] == '=') {
                    // read value
                    ++at;
                    if(at < header.length && header[at] == '\"') {
                        start = at + 1;

                        // find end of quoted param value
                        at = header.indexOf('\"', start);
                        if (at == -1)
                            return null;
                        end = at;

                        val = header.substring(start, end);

                        ++at;
                    } else {
                        start = at;

                        // find end of param value
                        for (; at < header.length; ++at) {
                            if (header[at] == ',' || header[at] == ';')
                                break;
                        }
                        end = at;

                        val = header.substring(start, end);
                    }
                }

                readParams = false;
                if (at < header.length) {
                    if (header[at] == ',') {
                        readLink = true;
                        ++at;
                    } else if (header[at] == ';') {
                        readParams = true;
                        ++at;
                    } else {
                        return null;
                    }
                }

                if (name == 'rel')
                    rel = val;
                else
                    params[name] = val;
            }

            if (rel) {
                var rels = rel.split(' ');
                for (var i = 0; i < rels.length; ++i) {
                    debug.info('link: url=[' + url + '], rel=[' + rels[i] + ']');
                    var link = {};
                    link.rel = rels[i];
                    link.href = url;
                    for (var paramName in params) {
                        if (!params.hasOwnProperty(paramName))
                            continue;
                        link[paramName] = params[paramName];
                    }
                    links[link.rel] = link;
                }
            }
        }

        return links;
    };

    var nextUpdate = function(predicate, ctx) {
        return window.setTimeout(function() {
            predicate.apply(ctx);
        }, 0);
    };

    var Engine = function () {
        this._resources = {};
        this._timer = null;
        this._multiplexWebSockets = {};
        this._multiplexWaitPolls = {};
        this._valueWaitPolls = {};
        this._changesWaitPolls = {};
    };
    Engine.prototype._getPreferredEndpointsForResources = function() {
        var valueWaitEndpoints = {};
        var multiplexWsEndpoints = {};
        var multiplexWaitEndpoints = {};
        var changeWaitPolls = {};

        forEachOwnKeyValue(this._resources, function(resUri, res) {
            if (res.changesWaitUri) {
                changeWaitPolls[res.changesWaitUri] = res;
            } else {
                if (res.multiplexWsUri) {
                    var endpoint = getOrCreateKey(multiplexWsEndpoints, res.multiplexWsUri, { items: [] });
                    endpoint.items.push(res);
                } else if (res.multiplexWaitUri) {
                    var endpoint = getOrCreateKey(multiplexWaitEndpoints, res.multiplexWaitUri, { items: [] });
                    endpoint.items.push(res);
                } else {
                    valueWaitEndpoints[res.valueWaitUri] = res;
                }
            }
        }, this);

        var result = {
            valueWaitEndpoints: {},
            multiplexWsEndpoints: {},
            multiplexWaitEndpoints: {},
            changeWaitPolls: {}
        };

        forEachOwnKeyValue(multiplexWsEndpoints, function(waitUri, endpoint) {
            result.multiplexWsEndpoints[waitUri] = { items: endpoint.items };
        }, this);
        forEachOwnKeyValue(multiplexWaitEndpoints, function(waitUri, endpoint) {
            if (endpoint.items.length > 1 || !endpoint.items[0].valueWaitUri) {
                result.multiplexWaitEndpoints[waitUri] = { items: endpoint.items };
            } else {
                valueWaitEndpoints[endpoint.items[0].valueWaitUri] = endpoint.items[0];
            }
        }, this);
        forEachOwnKeyValue(valueWaitEndpoints, function(waitUri, endpoint) {
            result.valueWaitEndpoints[waitUri] = { item: endpoint };
        }, this);
        forEachOwnKeyValue(changeWaitPolls, function(waitUri, endpoint) {
            result.changeWaitPolls[waitUri] = { item: endpoint };
        }, this);

        return result;
    };
    Engine.prototype._createMultiplexWsRequest = function(endpointUri, items) {
        var self = this;
        var request = {
            uri: endpointUri,
            socket: new WebSockHop(endpointUri),
            resItems: items,
            isActive: false
        };
        return request;
    };
    Engine.prototype._createValueWaitRequest = function(endpointUri, item) {
        var self = this;
        var poll = {
            uri: endpointUri,
            request: new Pollymer.Request(),
            res: item,
            isActive: false
        };
        poll.request.on("finished", function(code, result, headers) {
            poll.isActive = false;
            self._onFinishedValueWait(poll, code, result, headers);
        });
        return poll;
    };
    Engine.prototype._onFinishedValueWait = function(poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            forEachOwnKeyValue(headers, function(key, header) {
                var lkey = key.toLocaleLowerCase();
                if (lkey == 'etag') {
                    poll.res.etag = header;
                    return false;
                }
            });

            for (var i = 0; i < poll.res.owners.length; i++) {
                var owner = poll.res.owners[i];
                owner._events.trigger('value', owner, result);
            }
        }

        this._update();
    };
    Engine.prototype._createMultiplexWaitRequest = function(endpointUri, items) {
        var self = this;
        var poll = {
            uri: endpointUri,
            request: new Pollymer.Request(),
            resItems: items,
            isActive: false
        };
        poll.request.on("finished", function(code, result, headers) {
            poll.isActive = false;
            self._onFinishedMultiplexWait(poll, code, result, headers);
        });
        return poll;
    };
    Engine.prototype._onFinishedMultiplexWait = function(poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            forEachOwnKeyValue(result, function (uri, item) {

                debug.info('got data for uri: ' + uri);

                var absoluteUri = toAbsoluteUri(poll.uri, uri);

                forEachOwnKeyValue(this._resources, function (resUri, res) {
                    if (resUri == absoluteUri) {

                        forEachOwnKeyValue(item.headers, function(key, header) {
                            var lkey = key.toLocaleLowerCase();
                            if (lkey == 'etag') {
                                res.etag = header;
                                return false;
                            }
                        });

                        for (var i = 0; i < res.owners.length; i++) {
                            var owner = res.owners[i];
                            owner._events.trigger('value', owner, item.body);
                        }

                        return false;
                    }
                }, this);

            }, this);

        }

        this._update();
    };
    Engine.prototype._createChangesWaitRequest = function(endpointUri, item) {
        var self = this;
        var poll = {
            uri: endpointUri,
            request: new Pollymer.Request(),
            res: item,
            isActive: false
        };
        poll.request.on("finished", function(code, result, headers) {
            poll.isActive = false;
            self._onFinishedChangesWait(poll, code, result, headers);
        });
        return poll;
    };
    Engine.prototype._onFinishedChangesWait = function (poll, code, result, headers) {

        if (code >= 200 && code < 300) {

            forEachOwnKeyValue(headers, function(key, header) {

                var lkey = key.toLowerCase();
                if (lkey == 'link') {
                    var links = parseLinkHeader(header);
                    if (links && links['changes-wait']) {
                        poll.res.changesWaitUri = links['changes-wait']['href'];
                        return false;
                    }
                }

            });

            for (var i = 0; i < poll.res.owners.length; i++) {
                var owner = poll.res.owners[i];

                for (var n = 0; n < result.length; ++n) {
                    if (result[n].deleted) {
                        owner._events.trigger('child-deleted', owner, result[n]);
                    } else {
                        owner._events.trigger('child-added', owner, result[n]);
                    }
                }
            }
        }

        this._update();
    };

    Engine.prototype._update = function () {
        if (!this._timer) {
            this._timer = nextUpdate(function () {

                this._timer = null;
                var _this = this;

                // restart our long poll
                debug.info('engine: setup long polls');

                var preferredEndpoints = this._getPreferredEndpointsForResources();

                var adjustEndpoints = function(label, requestList, endpointList, changeTest, abortRequest, newRequest, startRequest) {
                    var pollsToRemove = [];
                    forEachOwnKeyValue(requestList, function(endpointUri, request) {
                        var removedOrChanged = false;
                        if (endpointUri in endpointList) {
                            var ctx = {
                                endpoint: endpointList[endpointUri],
                                request: request,
                                removedOrChanged: removedOrChanged
                            };
                            changeTest(ctx);
                            removedOrChanged = ctx.removedOrChanged;
                        } else {
                            removedOrChanged = true;
                        }
                        if (removedOrChanged) {
                            pollsToRemove.push(endpointUri);
                        }
                        delete endpointList[endpointUri];
                    }, this);
                    for (var i = 0; i < pollsToRemove.length; i++) {
                        var pollToRemove = pollsToRemove[i];
                        debug.info("Remove '" + label + "' endpoint - '" + pollToRemove + "'.");
                        abortRequest(requestList[pollToRemove]);
                        delete requestList[pollToRemove];
                    }
                    forEachOwnKeyValue(endpointList, function(endpointUri, endpoint) {
                        debug.info("Adding '" + label + "' endpoint - '" + endpointUri + "'.");
                        requestList[endpointUri] = newRequest(endpointUri, endpoint);
                    }, this);
                    forEachOwnKeyValue(requestList, function(endpointUri, request) {
                        if (!request.isActive) {
                            var ctx = {
                                isActive: false,
                                endpointUri: endpointUri,
                                request: request
                            };
                            startRequest(ctx);
                            request.isActive = ctx.isActive;
                        }
                    });
                };

                adjustEndpoints(
                    "Multiplex WS",
                    this._multiplexWebSockets,
                    preferredEndpoints.multiplexWsEndpoints,
                    function(ctx) {
                        if (ctx.endpoint.items.length != ctx.request.resItems.length) {
                            ctx.removedOrChanged = true
                        } else {
                            var preferredEndpointItemUris = [];
                            for (var i = 0; i < ctx.endpoint.items.length; i++) {
                                preferredEndpointItemUris.push(ctx.endpoint.items[i].uri);
                            }
                            preferredEndpointItemUris.sort();

                            var pollResourceItemUris = [];
                            for (var i = 0; i < ctx.request.resItems.length; i++) {
                                pollResourceItemUris.push(ctx.request.resItems[i].uri);
                            }
                            pollResourceItemUris.sort();

                            for (var i = 0; i < preferredEndpointItemUris.length; i++) {
                                if (preferredEndpointItemUris[i] != pollResourceItemUris[i]) {
                                    ctx.removedOrChanged = true;
                                }
                            }
                        }},
                    function(request) { request.socket.abort(); },
                    function(endpointUri, endpoint) { return _this._createMultiplexWsRequest(endpointUri, endpoint.items); },
                    function(ctx) {
                        var requestUri = ctx.request.uri;
                        debug.info("Multiplex Ws Request URI: " + requestUri);

                        ctx.request.socket.on("opened", function() {

                            ctx.request.socket.on("message", function(data) {
                                console.log(data);
                            });

                            ctx.request.socket.request({
                                type: 'subscribe',
                                mode: 'value',
                                uri: requestUri
                            }, function (result) {
                                if (result.type == 'subscribed') {
                                    console.log(result);
                                }
                            });

                        });

                        // ctx.request.request.start('GET', requestUri, { 'If-None-Match': ctx.request.res.etag, 'Wait': 60 });
                        ctx.isActive = true;
                    }
                );

                adjustEndpoints(
                    "Value Wait",
                    this._valueWaitPolls,
                    preferredEndpoints.valueWaitEndpoints,
                    function(ctx) { if (ctx.endpoint.item.uri != ctx.request.res.uri) { ctx.removedOrChanged = true; } },
                    function(request) { request.request.abort(); },
                    function(endpointUri, endpoint) { return _this._createValueWaitRequest(endpointUri, endpoint.item); },
                    function(ctx) {
                        var requestUri = ctx.request.uri;
                        debug.info("Value Wait Request URI: " + requestUri);
                        ctx.request.request.start('GET', requestUri, { 'If-None-Match': ctx.request.res.etag, 'Wait': 55 });
                        ctx.isActive = true;
                    }
                );

                adjustEndpoints(
                    "Multiplex Wait",
                    this._multiplexWaitPolls,
                    preferredEndpoints.multiplexWaitEndpoints,
                    function(ctx) {
                        if (ctx.endpoint.items.length != ctx.request.resItems.length) {
                            ctx.removedOrChanged = true
                        } else {
                            var preferredEndpointItemUris = [];
                            for (var i = 0; i < ctx.endpoint.items.length; i++) {
                                preferredEndpointItemUris.push(ctx.endpoint.items[i].uri);
                            }
                            preferredEndpointItemUris.sort();

                            var pollResourceItemUris = [];
                            for (var i = 0; i < ctx.request.resItems.length; i++) {
                                pollResourceItemUris.push(ctx.request.resItems[i].uri);
                            }
                            pollResourceItemUris.sort();

                            for (var i = 0; i < preferredEndpointItemUris.length; i++) {
                                if (preferredEndpointItemUris[i] != pollResourceItemUris[i]) {
                                    ctx.removedOrChanged = true;
                                }
                            }
                        }
                    },
                    function (request) { request.request.abort(); },
                    function (endpointUri, endpoint) { return _this._createMultiplexWaitRequest(endpointUri, endpoint.items.slice()); },
                    function (ctx) {
                        var urlSegments = [];
                        for (var i = 0; i < ctx.request.resItems.length; i++) {
                            var res = ctx.request.resItems[i];
                            var uri = res.uri;
                            urlSegments.push('u=' + encodeURIComponent(uri) + '&inm=' + encodeURIComponent(res.etag));
                        }
                        var requestUri = ctx.request.uri + '?' + urlSegments.join('&');

                        debug.info("Multiplex Wait Request URI: " + requestUri);
                        ctx.request.request.start('GET', requestUri, { 'Wait': 55 });
                        ctx.isActive = true;
                    }
                );

                adjustEndpoints(
                    "Changes Wait",
                    this._changesWaitPolls,
                    preferredEndpoints.changeWaitPolls,
                    function(ctx) { if (ctx.endpoint.item.uri != ctx.request.res.uri) { ctx.removedOrChanged = true; } },
                    function(request) { request.request.abort(); },
                    function(endpointUri, endpoint) { return _this._createChangesWaitRequest(endpointUri, endpoint.item); },
                    function(ctx) {
                        var requestUri = ctx.request.uri;
                        debug.info("Changes Wait Request URI: " + requestUri);
                        ctx.request.request.start('GET', requestUri, { 'Wait': 55 });
                        ctx.isActive = true;
                    }
                );

            }, this);
        }
    };

    Engine.prototype._getOrCreateResource = function (uri) {
        if (!(uri in this._resources)) {
            this._resources[uri] = {
                uri: uri,
                owners: []
            };
        }
        return this._resources[uri];
    };

    Engine.prototype.addObjectResource = function (owner, uri, etag, valueWaitUri, multiplexWaitUri, multiplexWsUri) {
        var res = this._getOrCreateResource(uri);
        res.owners.push(owner);
        res.etag = etag;
        res.valueWaitUri = valueWaitUri;
        res.multiplexWaitUri = multiplexWaitUri;
        res.multiplexWsUri = multiplexWsUri;
        this._update();
    };

    Engine.prototype.addCollectionResource = function (owner, uri, changesWaitUri) {
        var res = this._getOrCreateResource(uri);
        res.owners.push(owner);
        res.changesWaitUri = changesWaitUri;
        this._update();
    };

    var engine = new Engine();

    var LiveResource = function (uri) {
        if (!(this instanceof LiveResource)) {
            throw new window.Error("Constructor called as a function");
        }

        this._events = new Events();
        this._uri = toAbsoluteUri(window.location.href, uri);
        this._started = false;
        this._etag = null;
        this._valueWaitUri = null;
        this._changesWaitUri = null;
        this._multiplexWsUri = null;
    };
    LiveResource.prototype.on = function (type, handler) {
        this._events.on(type, handler);

        if(type == 'value' || type == 'removed') {
            var self = this;

            var request = new Pollymer.Request();
            request.on('finished', function(code, result, headers) {

                var etag = null;
                var valueWaitUri = null;
                var multiplexWaitUri = null;
                var multiplexWsUri = null;

                forEachOwnKeyValue(headers, function(key, header) {

                    var lkey = key.toLowerCase();
                    if (lkey == 'etag') {
                        etag = header;
                    } else if (lkey == 'link') {
                        var links = parseLinkHeader(header);
                        if (links && links['value-wait']) {
                            valueWaitUri = toAbsoluteUri(self._uri, links['value-wait']['href']);
                        }
                        if (links && links['multiplex-wait']) {
                            multiplexWaitUri = toAbsoluteUri(self._uri, links['multiplex-wait']['href']);
                        }
                        if (links && links['multiplex-ws']) {
                            multiplexWsUri = toAbsoluteUri(self._uri, links['multiplex-ws']['href']);
                        }
                    }

                });

                if (etag) {
                    debug.info('etag: [' + etag + ']');
                    self._etag = etag;
                }

                if (valueWaitUri) {
                    debug.info('value-wait: [' + valueWaitUri + ']');
                    self._valueWaitUri = valueWaitUri;
                }

                if (multiplexWaitUri) {
                    debug.info('multiplex-wait: [' + multiplexWaitUri + ']');
                }

                if (multiplexWsUri) {
                    debug.info('multiplex-ws: [' + multiplexWsUri + ']');
                    self._multiplexWsUri = multiplexWsUri;
                }

                if(code >= 200 && code < 400) {
                    // 304 if not changed, don't trigger value
                    if (code < 300) {
                        self._events.trigger('value', self, result);
                    }
                    if (self._etag) {
                        engine.addObjectResource(self, self._uri, self._etag, self._valueWaitUri, multiplexWaitUri, self._multiplexWsUri);
                        if (!this._started) {
                            this._started = true;
                            self._events.trigger('ready', self);
                        }
                    }
                    request = null;
                } else if(code >= 400) {
                    if (code == 404) {
                        if (this._started) {
                            self._events.trigger('removed', self);
                        }
                        request = null;
                    } else {
                        request.retry();
                    }
                }
            });
            request.start('GET', this._uri);

        } else if(type == 'child-added' || type == 'child-deleted') {

            // Collection section of spec
            var self = this;

            var request = new Pollymer.Request();
            request.on('finished', function(code, result, headers) {

                var changesWaitUri = null;

                forEachOwnKeyValue(headers, function(key, header) {

                    var lkey = key.toLowerCase();
                    if (lkey == 'link') {
                        var links = parseLinkHeader(header);
                        if (links && links['changes-wait']) {
                            changesWaitUri = links['changes-wait']['href'];
                        }
                    }

                });

                if (changesWaitUri) {
                    debug.info('changes-wait: [' + changesWaitUri + ']');
                    self._changesWaitUri = changesWaitUri;
                }

                if(code >= 200 && code < 300) {
                    // 304 if not changed, don't trigger changes
                    if (code < 300) {
                        for (var n = 0; n < result.length; ++n) {
                            if (result[n].deleted) {
                                self._events.trigger('child-deleted', self, result[n]);
                            } else {
                                self._events.trigger('child-added', self, result[n]);
                            }
                        }
                    }
                    if (self._changesWaitUri) {
                        engine.addCollectionResource(self, self._uri, self._changesWaitUri);
                        if (!self._started) {
                            self._started = true;
                            self._events.trigger('ready', self);
                        }
                        request = null;
                    } else {
                        debug.info('no changes-wait link');
                    }
                } else if (code >= 400) {
                    request.retry();
                }
            });
            request.start('HEAD', this._uri);
        }
    };
    LiveResource.prototype.off = function (type, handler) {
        var args = copyArray(arguments, 1);
        args.unshift(type);
        this._events.off.apply(this._events, args);
    };
    return LiveResource;
});
