import { toAbsoluteUri, beginsWith, replaceStart } from 'utils';
import getWindowLocationHref from 'utils.getWindowLocationHref';

export const mapHttpUrlToWebSocketUrl = (url) => {
    const windowLocationHref = getWindowLocationHref();
    const absoluteUri = toAbsoluteUri(windowLocationHref, url);

    let converted = absoluteUri;
    if (beginsWith(absoluteUri, "http://")) {
        converted = replaceStart(absoluteUri, "http://", "ws://");
    } else if (beginsWith(absoluteUri, "https://")) {
        converted = replaceStart(absoluteUri, "https://", "wss://");
    }

    if (!beginsWith(converted, "ws://") && !beginsWith(converted, "wss://")) {
        throw "not valid";
    }

    return converted;
};

export const mapWebSocketUrlToHttpUrl = (url) => {
    let converted = url;
    if (beginsWith(url, "ws://")) {
        converted = replaceStart(url, "ws://", "http://");
    } else if (beginsWith(url, "wss://")) {
        converted = replaceStart(url, "wss://", "https://");
    }

    if (!beginsWith(converted, "http://") && !beginsWith(converted, "https://")) {
        throw "not valid";
    }

    return converted;
};
