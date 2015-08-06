var utils = require('./utils');

module.exports = {
    mapHttpUrlToWebSocketUrl: function(uri) {
        var windowLocationHref = require('./utils.getWindowLocationHref')();
        var absoluteUri = utils.toAbsoluteUri(windowLocationHref, uri);

        var converted = absoluteUri;
        if (utils.beginsWith(absoluteUri, "http://")) {
            converted = utils.replaceStart(absoluteUri, "http://", "ws://");
        } else if (utils.beginsWith(absoluteUri, "https://")) {
            converted = utils.replaceStart(absoluteUri, "https://", "wss://");
        }

        if (!utils.beginsWith(converted, "ws://") && !utils.beginsWith(converted, "wss://")) {
            throw "not valid";
        }

        return converted;
    },
    mapWebSocketUrlToHttpUrl: function(url) {
        var converted = url;
        if (utils.beginsWith(url, "ws://")) {
            converted = utils.replaceStart(url, "ws://", "http://");
        } else if (utils.beginsWith(url, "wss://")) {
            converted = utils.replaceStart(url, "wss://", "https://");
        }

        if (!utils.beginsWith(converted, "http://") && !utils.beginsWith(converted, "https://")) {
            throw "not valid";
        }

        return converted;
    }
};
