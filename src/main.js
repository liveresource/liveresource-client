// Polyfill for ES5 environments
import "babel-polyfill";

// Build the default LiveResource constructor

// 1. Create a new engine
import Engine from 'Framework/Engine';
const engine = new Engine();

// 2. Add engine units
import ValueEngineUnit from 'EngineUnits/Value/ValueEngineUnit';
const valueEngineUnit = new ValueEngineUnit();
engine.addEngineUnit(valueEngineUnit);

import ChangesEngineUnit from 'EngineUnits/Changes/ChangesEngineUnit';
const changesEngineUnit = new ChangesEngineUnit();
engine.addEngineUnit(changesEngineUnit);

// 3. Create a constructor that would create LiveResource instances
// associated with this engine.
import LiveResource from 'Framework/LiveResource';
const liveResourceClass = LiveResource.createLiveResourceConstructorWithEngine(engine);

export default liveResourceClass;
