var test = require('tape');
var LiveResource = require('../src/main.js');

test('new returns LiveResource object', function(t) {
    var result = new LiveResource('dummy-path');
    t.equal(result.constructor, LiveResource);
    t.end();
});
