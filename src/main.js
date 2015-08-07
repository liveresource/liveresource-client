var Engine = require('engine-components/Engine');
var ValueEngineUnit = require('value/ValueEngineUnit');
var ChangesEngineUnit = require('changes/ChangesEngineUnit');

var engine = Engine();
engine.addEngineUnit(new ValueEngineUnit());
engine.addEngineUnit(new ChangesEngineUnit());

module.exports = require('engine-components/LiveResource');