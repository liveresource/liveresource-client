// Build the default LiveResource constructor

// 1. Create a new engine
const Engine = require('Engine/Engine');
const engine = new Engine();

// 2. Add engine units
const ValueEngineUnit = require('EngineUnits/Value/ValueEngineUnit');
engine.addEngineUnit(new ValueEngineUnit());

const ChangesEngineUnit = require('EngineUnits/Changes/ChangesEngineUnit');
engine.addEngineUnit(new ChangesEngineUnit());

// 3. Create a constructor that would create LiveResource instances
// associated with this engine.
const LiveResource = require('ResourceHandling/LiveResource');
const liveResourceClass = LiveResource.createLiveResourceConstructorWithEngine(engine);

export default liveResourceClass;
