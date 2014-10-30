var utils = (function() {

    function extend(target, source) {
        if (source) {
            for(var prop in source) {
                if(source.hasOwnProperty(prop)) {
                    target[prop] = source[prop];
                }
            }
        }
        return target;
    }

    var copyArray = function (array) {
        var args = Array.prototype.slice.call(arguments, 1);
        return Array.prototype.slice.apply(array, args);
    };

    var findInArray = function (array, item) {
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
            var index = utils.findInArray(array, item);
            if (index != -1) {
                array.splice(index, 1);
            } else {
                again = false;
            }
        }
    };

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

    return {
        extend: extend,
        copyArray: copyArray,
        findInArray: findInArray,
        removeFromArray: removeFromArray,
        toAbsoluteUri: absolutizeURI,
        forEachOwnKeyValue: function(obj, predicate, ctx) {
            for(var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    var result = predicate.call(ctx || this, key, obj[key]);
                    if (typeof(result) != 'undefined' && !result) {
                        break;
                    }
                }
            }
        },
        getOrCreateKey: function(obj, key, defaultValue) {
            if (!(key in obj)) {
                obj[key] = defaultValue;
            }
            return obj[key];
        },
        beginsWith: function(str, find) {
            return str.substring(0, find.length) == find;
        },
        replaceStart: function(str, find, replace) {
            return replace + str.substring(find.length);
        },
        nextUpdate: function(predicate, ctx) {
            return window.setTimeout(function() {
                predicate.apply(ctx);
            }, 0);
        }
    };
}());

if (!Function.prototype['bind']) {
    // Function.prototype.bind is a standard part of ECMAScript 5th Edition (December 2009, http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf)
    // In case the browser doesn't implement it natively, provide a JavaScript implementation. This implementation is based on the one in prototype.js
    Function.prototype['bind'] = function (object) {
        var originalFunction = this, args = Array.prototype.slice.call(arguments), object = args.shift();
        return function () {
            return originalFunction.apply(object, args.concat(Array.prototype.slice.call(arguments)));
        };
    };
}