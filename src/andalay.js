/**
 * Angular Andalay.
 * ================
 * ####In a nutshell: Backbone-esc Models for Angular. 
 * Andalay is essentially a fork of Backbone, with a few key differences.
 * 1: No attributes array.  The attributes are the model properties.
 * 2: No events raised. Angular's two way data binding takes care of watching for data changes.
 * @author Steve O'Brien, Newicon Ltd
 * @property {object} @property Andalay Model
 * @property {object} @property Andalay Collection
 * @return {object} Andalay
 */
angular.module('Andalay', ['underscore']).factory('Andalay', ['$http', '$q', '$parse', '_',
	function($http ,  $q ,  $parse, _) {
	'use strict';

	var Andalay = {};

	/**
	 * Represents a singular model.
	 * A collection contains an array of Andalay.Model objects.
	 * 
	 * ~~~js
	 * new Andalay.Model({name:'steve'});
	 * ~~~
	 * @class Andalay  Andalay for AngularJS
	 * @constructor
	 * @param {Object} attributes Initialize the record with these properties
	 * @param {Object} options Options object
	 * @return void
	 */
	Andalay.Model = function(attributes, options) {
		// extend the model with default properties, override defaults if specified in attributes
		var attrs = attributes || {};
		options = options || {};
		// give the model an autogenerated client id
		this.cid = _.uniqueId('c');
		if (options.parse) attrs = this.parse(attrs, options) || {};
		attrs = _.defaults({}, attrs, angular.copy(_.result(this, 'defaults')));
		if (attrs) {
			angular.extend(this, attrs);
		}
		this.initialize.apply(this, arguments);
	};

	/**
	 * Define the Model's inheritable methods.
	 * @return void
	 */
	Andalay.Model.prototype = {

		/**
		 * `string` Stores the name of the attribute (property) that the id value is stored in.
		 */
		idAttribute: 'id',

		/**
		 * `boolean` whether the model is currently loading.
		 */
		loading: false,

		/**
		 * `boolean` whether the model is currently saving.
		 */
		saving: false,

		/**
		 * `object` define default attributes to set on this model.
		 */
		defaults: {},

		/**
		 * Initialize is an empty function by default. Override it with your own initialization logic.
		 */
		initialize: function() {},
		
		/**
		 * Returns an object that can be json-ified.
		 * @return {object} Object consumable by JSON.stringify();
		 */
		toJSON: function() {
			var json = angular.copy(this);
			delete json.collection;
			delete json.cid;
			return json;
		},
		
		/**
		 * Whether the model has a specified property.
		 * @param {string} property name
		 * @return {boolean}
		 */
		has: function(property){
			return angular.isDefined(this[property]);
		},
		
		/** 
		 * Parse converts a response into the hash of attributes to be set on the model. 
		 * The default implementation passes the response along.
		 * @param {object} response The response from the server
		 * @param {object} options
		 * @return {object} The (altered) response
		 */
		parse: function(response, options) {
			return response;
		},
		
		/**
		 * A model without an id attribute is considered to be new.
		 * @return {boolean} Is the object new?
		 */
		isNew: function() {
			return !this.has(this.idAttribute);
		},
		
		/**
		 * Return the result of the model's validation function.
		 * @return {boolean} The result of validate()
		 */
		isValid: function() {
			return this.validate();
		},
		
		/**
		 * You can override this function to provide the url for this model resource.
		 * @return {string} the url for the model resource
		 */
		url: function() {
			var base =
			  _.result(this, 'urlRoot') ||
			  _.result(this.collection, 'url') ||
			  urlError();
			if (this.isNew()) return base;
			var id = this.id || this[this.idAttribute];
			return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(id);
		},
		
		/**
		 * Override this function to provide custom validation rules.
		 * @return {boolean} The result of the validation rules. Defaults to `true`
		 */
		validate: function() {
			return true;
		},
		
		/**
		 * A proxy to Andalay.sync().
		 * @return {object} Promise object
		 */
		sync: function() {
			return Andalay.sync.apply(this, arguments);
		},
		
		/**
		 * Fetch the model with its ID.
		 * @param {type} options Options object. If `parse` is set to false, the server response is not run through model.parse()
		 * @returns {object} Promise object
		 */
		fetch: function (options) {
			options = options ? _.clone(options) : {};
			if (options.parse === void 0) {
				options.parse = true;
			}
			var model = this;
			model.loading = true;
			return this.sync('read', this, options).then(function(response){
				model.loading = false;
				var data = options.parse ? model.parse(response.data) : response.data;
				angular.extend(model, data);
			}, function(err){
				throw new Error('Error retrieving model');
			});
		},

		/**
		 * Saves the current model to the backend.
		 * @param {object} Options object. `validate: false` prevents validation and forces save; defaults to true
		 * @return {object} Promise object
		 */
		save: function(options){
			var method = this.isNew() ? 'create' : 'update';
			options = _.defaults((options || {}), {validate:true});
			this.setSaving(true);
			var deferred = $q.defer();
			if (options.validate && !this.validate()) {
				deferred.reject('Validation failed');
			}
			var model = this;
			return this.sync(method, this, options).then(function(response) {
				// Success
				model.setSaving(false);
				angular.extend(model, model.parse(response.data));
				deferred.resolve(response);
			}, function(response){
				// Error, assumes if request fails the returned data is an array of errors.
				// In the format [{attribute:['error message']}]
				model._errors = response.data;
				deferred.reject(response);
			});
		},

		/**
		 * Delete the model on the server, and remove it from its parent collection.
		 * @return {object} Promise object
		 */
		delete: function() {
			var model = this;
			model.loading = true;
			return this.sync('delete', this).then(function(response){
				model.loading = false;
				if (angular.isDefined(model.collection)) {
					model.collection.remove(model.id);
				}
				model[model.idAttribute] = null;
			}, function(err){
				throw new Error('Error deleting model');
			});
		},
		
		// Store errors
		_errors:{},
		
		/**
		 * Sets the saving address.
		 * @param {boolean} isSaving the state to set Model.saving
		 * @returns void
		 */
		setSaving: function(isSaving) {
			this.saving = isSaving;
			if (this.collection) {
				this.collection.saving = isSaving;
			}
		}
	};
	
	// Add additional relevent underscore methods to the Model.
	var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit', 'chain', 'isEmpty'];
	_.each(modelMethods, function(method) {
		if (!_[method]) return;
		Andalay.Model.prototype[method] = function() {
			var args = [].slice.call(arguments);
			args.unshift(this);
			return _[method].apply(_, args);
		};
	});
	
	/**
	 * Andalay.Collection
	 * ------------------
	 * Represents a collection of Andalay.Model objects.
	 * Creates a new `Collection`, to contain a specific type of `Model`.
	 * @param {Array} models Array of objects|models to add to the collection
	 * @param {Object} options Passing a `model` property sets the model property of the collection: `MyCollection = new Andalay.Collection([{..}], {model:Andalay.Model})`
	 * @return void
	 */
	Andalay.Collection = function(models, options) {
		options = options || {};
		if (options.model) this.model = options.model;
		this._reset();
		this.initialize.apply(this, arguments);
		if (models) this.reset(models);
	};

	/**
	 * Define the collection's inheritable methods.
	 */
	Andalay.Collection.prototype = {
		
		/**
		 * `object` The default model for a collection is just a **Backbone.Model**.
		 * This should be overridden in most cases.
		 */
		model: Andalay.Model,
		
		/**
		 * `boolean` Whether the collection is currently loading.
		 */
		loading:false,
		
		/**
		 * `boolean` Whether a model within the collection is currently saving.
		 */
		saving: false,
		
		/**
		 * `array` Stores the list of models.
		 */
		models: [],

		/**
		 * `object` Stores an indexed array of objects id:object and cid:object.
		 */
		_index:{},

		/**
		 * `int` Mirrors the length of the models array.
		 */
		length: 0,
		
		/**
		 * Initialize is an empty function by default. Override it with your own initialization logic.
		 */
		initialize: function(properties, options) {},
		
		/**
		 * Returns an object that can be json-ified.
		 * @return {object} Object consumable by JSON.stringify();
		 */
		toJSON: function() {
			var json = [];
			this.forEach(function(model, index) {
				json.push(model.toJSON());
			});
			return json;
		},

		/**
		 * Add a Model to the collection. If the model already exists in the collection, extend it.
		 * @param {object} obj An object or a Model
		 * @param {object} options Options object. `options.at` (int) specifies the position to add the model in the collection
		 * @return {object} The added object as an instance of the Model
		 */
		addOne: function(obj, options) {
			var id, existing, index;
			options = options || {};
			if (_.isArray(obj))
				throw new Error('The object to add must be an object. Array given');
			if (!_.isObject(obj)){
				throw new Error('Cannot add "' + obj + '" to the collection. You must specify an object to add');
			}
			index = (options.at !== void 0) ? options.at : this.models.length;
			var model = this.get(obj);
			if (this.exists(obj)) {
				// already exists in the collection so extend it.
				angular.extend(model, obj);
			} else {
				// add a new one
				model = this._prepareModel(obj);
				this._addReference(model);
				// add the model to the models array
				this.models.splice(index, 0, model);
				this.length += 1;
			}
			return model;
		},
		
		/** 
		 * Parse converts a response into the hash of attributes to be set on the model. 
		 * The default implementation passes the response along.
		 * @param {object} response The response from the server
		 * @param {object} options Options object
		 * @return {object} The (altered) response object
		 */
		parse: function(response, options) {
			return response;
		},
		
		/**
		 * Add an array of objects to the collection. 
		 * It will merge if the object already exists and add if it does not.
		 * For example:
		 * ~~~js
		 * var myCollection = Collection.addMany([{name:'test object'},{name:'another test object'}])
		 * ~~~
		 * @param {array} models Array of objects to add
		 * @throw Error if models param is not an array
		 * @return {array} An array of added or prexisting models
		 */
		addMany: function(models) {
			if (!_.isArray(models)) {
				throw new Error('Cannot add ' + models + ', models must be an array of objects');
			}
			var added = [];
			for (var i = 0; i < models.length; i++) {
				var obj = models[i];
				added.push(this.addOne(obj));
			}
			return added;
		},
		
		/**
		 * Proxy to addMany.
		 * @param {object} Array of objects to add
		 * @return {array} An array of added or prexisting models
		 */
		updateMany: function(models) {
			return this.addMany(models);
		},

		/** 
		 * When you have more items than you want to add or remove individually,
		 * you can reset the entire set with a new list of models.
		 * @param {array} Array of objects to add
		 * @return {array} Array of models that the collection has been reset to
		 */
		reset: function (models) {
			this._reset();
			if (models)
				return this.addMany(models);
			return [];
		},
		
		/**
		 * Get a model from the collection by id.
		 * @param {mixed} obj Pass in the id, the cid or an object.
		 * If passed an object it will attempt to get the id from the objects property specified by the model.idAttribute
		 * @return {mixed} Andalay.Model | undefined
		 */
		get: function(obj) {
			// Must specify a valid object or id.
			// Allow ids of value 0.
			if (!obj && obj !== 0) return void 0;
			return this._index[obj] || this._index[this.modelId(obj)] || this._index[obj.cid];
		},

		/**
		 * Returns whether a model exists in the collection with the id.
		 * @param {mixed} obj Pass in the id, the cid or an object.
		 * @see this.get()
		 * @return {boolean} True if a model exists
		 */
		exists: function(id) {
			return !angular.isUndefined(this.get(id));
		},
		
		/**
		 * Update a model.
		 * @param {object} obj An object or a Model
		 * @return {object} The added object as an instance of the Model
		 */
		update: function(model) {
			return this.addOne(model);
		},

		/**
		 * Remove a model.
		 * @param {mixed} Pass in the id, the cid or an object.
		 * @return {mixed} The removed model, or `undefined` if no model found to remove.
		 */
		remove: function(id) {
			var model = this.get(id);
			if (_.isUndefined(model)) {
				return void 0;
			}
			this._removeReference(model);
			var index = _.indexOf(this.models, model);
			this.models.splice(index, 1);
			this.length--;
			return model;
		},

		/**
		 * Removes all models from the collection.
		 * @return {object} this
		 */
		removeAll: function() {
			this.reset();
			return this;
		},

		/**
		 * Returns the id value of the passed in Model.
		 * @param {object} object Model
		 * @return {mixed} string | interger
		 */
		modelId: function (object) {
			return object[this.model.prototype.idAttribute || 'id'];
		},

		/**
		 * Gets the last model in the collection.
		 * @return {object} Model
		 */
		last: function() {
			return this.models[this.length-1];
		},
		
		/**
		 * Returns the model at the specified position in the array.
		 * @param {int} index position of the Model
		 * @return {object} Model 
		 */
		at: function(index) {
			return this.models[index];
		},
		
		/**
		 * Returns the size of the collection.
		 * @return {int} Size of the collection
		 */
		size: function() {
			return this.models.length;
		},
		
		/**
		 * Get all models in the collection as array.
		 * @return {Array} Array of models
		 */
		all: function() {
			return this.models;
		},

		/**
		 * Return models with matching attributes. Useful for simple cases of filter.
		 * @param {object} attrs Object with attributes to match
		 * @param {boolean} first If true, returns the first model it matches
		 * @returns {mixed}
		 */
		where: function (attrs, first) {
			var matches = _.matches(attrs);
			return this[first ? 'find' : 'filter'](function (model) {
				return matches(model);
			});
		},
		
		/**
		 * Return the first model with matching attributes. Useful for simple cases of find.
		 * @param {object} attrs Object with attributes to match
		 * @returns {object} Model
		 */
		findWhere: function (attrs) {
			return this.where(attrs, true);
		},
		
		/**
		 * A proxy to Andalay.sync().
		 * @return {object} Promise object
		 */
		sync: function() {
			return Andalay.sync.apply(this, arguments);
		},
		
		/**
		 * Fetch the default set of models for this collection from the server,
		 * resetting the collection when they arrive. If `reset: true` is passed, 
		 * the response data will be passed through the reset() method instead of set().
		 * @param {object} options Options object
		 * @returns {object} Promise object
		 */
		fetch: function (options) {
			options = options ? _.clone(options) : {};
			if (options.parse === void 0) {
				options.parse = true;
			}
			var collection = this;
			collection.loading = true;
			return this.sync('read', this, options).then(function(response){
				collection.loading = false;
				var data = options.parse ? collection.parse(response.data) : response.data;
				collection.addMany(data);
			}, function(){
				// error
			});
		},

		/**
		 * Private method to reset all internal state. Called when the collection
		 * is first initialized or reset.
		 */
		_reset: function() {
			this.length = 0;
			this.models = [];
			this._index = {};
		},
		
		/**
		 * Prepare a hash of attributes (or other model) to be added to this
		 * collection.
		 * @param {object} object The would-be model.
		 * @return {object} A bona fide model.
		 */
		_prepareModel: function(object) {
			var model = object;
			if (object instanceof Andalay.Model) {
				model = object;
			} else {
				model = new this.model(object);
			}
			model.collection = this;
			return model;
		},

		/**
		 * Adds the model to the internal index (idIndex).
		 * This essentially makes the collection aware of the model,
		 * as it uses this index to search for models both by its autogenerated
		 * client id and by its idAttribute if it exists and is not null.
		 * @param {object} model Model
		 * @return void
		 */
		_addReference: function(model) {
			this._index[model.cid] = model;
			var id = this.modelId(model);
			if (angular.isDefined(id) && id !== null) {
				this._index[id] = model;
			}
		},

		/**
		 * Removes all internal references to a model.
		 * @return void
		 */
		_removeReference: function(model) {
			delete this._index[model.cid];
			var id = this.modelId(model);
			if (angular.isDefined(id) && id !== null) {
				delete this._index[id];
			}
		}
		
	};

	var methods = ['forEach', 'each', 'find', 'filter'];

	// Additional relevant underscore functions to add:
	// 'map', 'collect', 'reduce', 'foldl',
	// 'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
	// 'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
	// 'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
	// 'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
	// 'lastIndexOf', 'isEmpty', 'chain', 'sample', 'partition'
	_.each(methods, function(method) {
		if (!_[method]) return;
		Andalay.Collection.prototype[method] = function() {
			var args = [].slice.call(arguments);
			args.unshift(this.models);
			return _[method].apply(_, args);
		};
	});
	
	/**
	 * The point at which Andalay interacts with the $http service to persist model data.
	 * @param {string} method The method to use 
	 * @param {object} model The model to persist
	 * @param {object} options Options object. Pass in `url` or `data` to override. Additional options are passed to the $http service
	 * @return {object} Promise generated by $http
	 */
	Andalay.sync = function(method, model, options) {
		var methodMap = {
			'create': 'POST',
			'update': 'PUT',
			'patch': 'PATCH',
			'delete': 'DELETE',
			'read': 'GET'
		};
		options = options || {};
		var params = {method: methodMap[method]};
		// Ensure that we have a URL.
		if (angular.isUndefined(options.url)) {
			params.url = _.result(model, 'url') || urlError();
		}
		if (_.isUndefined(options.data) && model && (method === 'create' || method === 'update' || method === 'patch')) {
			params.data = model.toJSON();
		}
		var httpOptions = angular.extend(params, options);
		model.saving = true;
		return $http(httpOptions);
	};
	
	/**
	 * Create a subclass.
	 * Shamelessly pinched from backbone.
	 * @static
	 * @param {object} protoProps 
	 * @param {object} staticProps
	 * @return {function} Constructor function
	 */
	var extend = function(protoProps, staticProps) {
		var parent = this;
		var child;
		if (protoProps && _.has(protoProps, 'constructor')) {
			child = protoProps.constructor;
		} else {
			child = function(){ return parent.apply(this, arguments); };
		}
		// Add static properties to the constructor function, if supplied.
		_.extend(child, parent, staticProps);
		// Set the prototype chain to inherit from parent, without calling parent‘s constructor function.
		var Surrogate = function () { this.$constructor = child; };
		Surrogate.prototype = parent.prototype;
		child.prototype = new Surrogate();
		// Add prototype properties (instance properties) to the subclass, if supplied.
		if (protoProps) _.extend(child.prototype, protoProps);
		// Set a convenience property in case the parent’s prototype is needed later.
		child.__super__ = parent.prototype;
		return child;
	};
	
	var urlError = function() {
		throw new Error('A "url" property or function must be specified in the collection. If the model is not added to a collection it should have a urlRoot property');
	};
	
	/**
	 * Add extend function to Objects
	 */
	Andalay.Model.extend = Andalay.Collection.extend = extend;

	return Andalay;
}]);