var debug = require('console');

// TODO: REFACTOR THIS
// ** PARSE LINK HEADER **
// returns object with structure:
//   { reltype1: { href: url, otherparam1: val }, reltype2: { ... } }
// or return null if parse fails

module.exports = function (header) {
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