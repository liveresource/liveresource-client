(function(factory) {
    var isWindow = function(variable) {
        return variable && variable.document && variable.location && variable.alert && variable.setInterval;
    };
    if (!isWindow(window)) {
        throw "The current version of LiveResource may only be used within the context of a browser.";
    }
    // No module loader (plain <script> tag) - put directly in global namespace
    if (!('WebSockHop' in window)) {
        throw "Require WebSockHop";
    }
    window['LiveResource'] = factory(window, window['WebSockHop']);
}(function(window, WebSockHop) {
    var exports = {};
    var extensions = {};