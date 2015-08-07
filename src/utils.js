var findInArray = function(array, item) {
    for (var i = 0, length = array.length; i < length; i++) {
        if (array[i] === item) {
            return i;
        }
    }
    return -1;
};

var isInArray = function(array, item) {
    return !(findInArray(array, item) < 0);
};

var removeFromArray = function(array, item) {
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

var parseURI = function(url) {
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

var toAbsoluteUri = function(base, href) {// RFC 3986

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

var forEachOwnKeyValue = function(obj, predicate) {
    for(var key in obj) {
        if (obj.hasOwnProperty(key)) {
            var result = predicate(key, obj[key]);
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

var beginsWith = function(str, find) {
    return str.substring(0, find.length) == find;
};

var replaceStart = function(str, find, replace) {
    return replace + str.substring(find.length);
};

module.exports = {
    findInArray,
    isInArray,
    removeFromArray,
    toAbsoluteUri,
    forEachOwnKeyValue,
    getOrCreateKey,
    beginsWith,
    replaceStart
};
