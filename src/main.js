// Build the default LiveResource constructor

// 1. Create a new engine
var Engine = require('Engine/Engine');
var engine = new Engine();

// 2. Add engine units
var ValueEngineUnit = require('EngineUnits/Value/ValueEngineUnit');
engine.addEngineUnit(new ValueEngineUnit());

var ChangesEngineUnit = require('EngineUnits/Changes/ChangesEngineUnit');
engine.addEngineUnit(new ChangesEngineUnit());

// 3. Create a constructor that would create LiveResource instances
// associated with this engine.
var LiveResource = require('ResourceHandling/LiveResource');
var liveResourceClass = LiveResource.createLiveResourceConstructorWithEngine(engine);

module.exports = liveResourceClass;