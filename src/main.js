// Polyfill for ES5 environments
import "babel-polyfill";

// Build the default LiveResource constructor

// 1. Create a new engine
const Engine = require('Framework/Engine');
const engine = new Engine();

// 2. Add engine units
const ValueEngineUnit = require('EngineUnits/Value/ValueEngineUnit');
const valueEngineUnit = new ValueEngineUnit();
engine.addEngineUnit(valueEngineUnit);

const ChangesEngineUnit = require('EngineUnits/Changes/ChangesEngineUnit');
const changesEngineUnit = new ChangesEngineUnit();
engine.addEngineUnit(changesEngineUnit);

const CollectionEntry = require('Framework/CollectionEntry');
const defaultParser = (contentType, data) => {
    let out;
    if (contentType == valueEngineUnit.interestType) {
        out = data;
    } else if (contentType == changesEngineUnit.interestType) {
        data = JSON.parse(data);
        out = [];
        if (Array.isArray(data)) {
            var items = data;
            for(var i = 0; i < items.length; ++i) {
                var id = items[i].id;
                var deleted = items[i].deleted;
                delete items[i].deleted; // app should not see this
                out.push(new CollectionEntry(id, deleted, items[i]));
            }
        } else {
            var item = data;
            var id = item.id;
            var deleted = item.deleted;
            delete item.deleted; // app should not see this
            out.push(new CollectionEntry(id, deleted, item));
        }
    } else {
        // return null for unknown data type.
        out = null;
    }
    return out;
};
// 3. Create a constructor that would create LiveResource instances
// associated with this engine.
const LiveResource = require('Framework/LiveResource');
const liveResourceClass = LiveResource.createLiveResourceConstructorWithEngine(engine, defaultParser);

export default liveResourceClass;
