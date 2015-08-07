// Build the default LiveResource constructor

// 1. Create a new engine
var Engine = require('Engine/Engine');
var engine = new Engine();

// 2. Add engine units
var ValueEngineUnit = require('Aspects/Value/Engine/ValueEngineUnit');
engine.addEngineUnit(new ValueEngineUnit());

var ChangesEngineUnit = require('Aspects/Changes/Engine/ChangesEngineUnit');
engine.addEngineUnit(new ChangesEngineUnit());

// 3. Create a new ResourceHandlerFactory and pass in the engine.
var ResourceHandlerFactory = require('ResourceHandling/ResourceHandlerFactory');
var resourceHandlerFactory = new ResourceHandlerFactory(engine);

// 4. Add aspect factories
var ValueAspect = require('Aspects/Value/ValueAspect');
resourceHandlerFactory.addAspectClass(ValueAspect);

var ChangesAspect = require('Aspects/Changes/ChangesAspect');
resourceHandlerFactory.addAspectClass(ChangesAspect);

// 5. Create a new LiveResourceFactory and pass in the ResourceHandlerFactory.
var LiveResourceFactory = require('ResourceHandling/LiveResourceFactory');
var liveResourceFactory = new LiveResourceFactory(resourceHandlerFactory);

// 6. Call getCreate() of the LiveResourceFactory, which returns
//   a class whose constructor will create a LiveResource instance.
var liveResourceClass = liveResourceFactory.getLiveResourceClass();

module.exports = liveResourceClass;