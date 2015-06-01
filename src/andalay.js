/**
 * Angular Andalay.
 * Andalay is essentially a fork of backbone, with a few key differences.
 * 1: no attributes array.  The attributes are the models properties.
 * 2: No events raised.
 * Backbone-esc Models for Angular
 * @author Steve O'Brien, Newicon Ltd
 */
angular.module('Andalay', ['underscore']).factory('Andalay', ['$http', '$q', '$parse', '_',
    function($http ,  $q ,  $parse, _) {
    'use strict';

    var Andalay = {};

    /**
     * Andalay.Model
     * -------------
     * Represents a singular model
     * Typically a collection contains an array of Andalay.Model objects
     * new Andalay.Model({name:'steve'});
     *
     * @class Andalay  Andalay for AngularJS
     * @constructor
     * @param {Object} [attributes]  Initialize the record with these property values.
     * @param {Object} [options]
     */
    Andalay.Model = function(attributes, options) {
        // extend the model with default properties, override defaults if specified in attributes
        var attrs = attributes || {};
		options || (options = {});
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
     */
    Andalay.Model.prototype = {

        /**
         * Stores the name of the attribute (property) that the id value is stored in
         */
        idAttribute: 'id',

		/**
		 * A boolean whther the model is currently saving
		 */
		saving: false,

        /**
         * define default attributes to set on this model
         */
        defaults: {},

        /**
         * Initialize is an empty function by default. Override it with your own
         * initialization logic.
         */
        initialize: function() {},
		
		/**
		 * returns an object that can be json-ified
		 * @returns object
		 */
        toJSON: function() {
            var json = angular.copy(this);
            delete json['collection'];
            delete json['cid'];
            return json;
        },
		
		/**
		 * Whether the model has a specified property
		 * @param string property name
		 * @returns boolean
		 */
		has: function(property){
			return angular.isDefined(this[property]);
		},
		
		/** 
		 * parse converts a response into the hash of attributes to be set on the model. 
		 * The default implementation is just to pass the response along.
		 * @param {type} response
		 * @param object options
		 * @returns Object
		 */
		parse: function(response, options) {
			return response;
		},
		
		isNew: function() {
			return !this.has(this.idAttribute);
		},
		
		isValid: function() {
			return this.validate();
		},
		
		url: function() {
			var base =
			  _.result(this, 'urlRoot') ||
			  _.result(this.collection, 'url') ||
			  urlError();
			if (this.isNew()) return base;
			var id = this.id || this[this.idAttribute];
			return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(id);
		},
		
		validate: function() {
			return true;
		},
		
		sync: function() {
			return Andalay.sync.apply(this, arguments);
		},
		
		/**
		 * Saves the current model to the backend
		 * options {
		 *   validate:false (prevents validation and forces save) defaults to true
		 * }
		 * @returns promise
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
				// success
				model.setSaving(false);
				angular.extend(model, model.parse(response.data));
				deferred.resolve(response);
			}, function(response){
				// error, assumes if request fails the returned data is an array of errors.
				// In the format [{attribute:['error message']}]
				model._errors = response.data;
				deferred.reject(response);
			});
		},
		
		// store errors
		_errors:{},
		
		/**
		 * Sets the saving address
		 * @param {type} boolean
		 * @returns {undefined}
		 */
		setSaving: function(boolean){
			this.saving = boolean;
			if (this.collection)
				this.collection.saving = boolean;
		}
    };
	
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
     *
     * Represents a collection of Andalay.Model objects
     * Define the Collection's inheritable methods.
     * Create a new **Collection**, to contain a specific type of `model`.
     * @param array models - array of objects|models to add to the collection
     * @param object options passing a property of model sets the model property
     * of the collection:
     * MyCollection = new Andalay.Collection([{..}], {model:Andalay.Model})
     */
    Andalay.Collection = function(models, options) {
        options || (options = {});
        if (options.model) this.model = options.model;
        this._reset();
        this.initialize.apply(this, arguments);
        if (models) this.reset(models);
    };

    /**
     * Define the Collection's inheritable methods.
     */
    Andalay.Collection.prototype = {
        
        /**
         * The default model for a collection is just a **Backbone.Model**.
         * This should be overridden in most cases.
         */
        model: Andalay.Model,
		
		/**
		 * boolean whther the collection is currently loading
		 */
		loading:false,
		
		/**
		 * A boolean whether a model within the collection is currently saving
		 */
		saving: false,
        
        /**
         * stores the list of models
         */
        models: [],

        /**
         * stores an indexed array of objects id:object and cid:object
         */
        _index:{},

        /**
         * mirrors the length of the models array
         */
        length: 0,
        
        /**
         * initialization, constructor function
         */
        initialize: function(properties, options) {},
        
        /**
         * returns an object that can be json-ified
         * @returns object
         */
        toJSON: function() {
            var json = [];
            this.forEach(function(model, index) {
                json.push(model.toJSON());
            });
            return json;
        },

        /**
         * @param obj object the object to add
		 * @param options:
		 *		at: (int) specify the position to add the model in the collection
         * @return the added object as an instance of the Model
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
		 * Parse converts a response into a list of models to be added to the collection. 
		 * The default implementation is just to pass it through.
		 * @param {type} response
		 * @param object options
		 * @returns Array
		 */
		parse: function(response, options) {
			return response;
		},
        
        /**
         * @param models array of objects
         * @throw error if models param is not an array
         * @returns array of added or prexisting models
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
         * Updates an existing object or array of objects
         * will merge if it already exists and add if it does not
         * @param mixed object | array
         * @returns array
         */
        updateMany: function(models) {
            return this.addMany(models);
        },

        /** 
         * When you have more items than you want to add or remove individually,
         * you can reset the entire set with a new list of models
		 * @param options object {
		 *		parse:true // runs the parse method of each object added
		 * } 
		 * @return array of models that the collection has been reset to
         */
        reset: function (models) {
            this._reset();
            if (models)
                return this.addMany(models);
			return [];
        },
        
        /**
         * Get a model from the collection by id.
         * @param mixed obj. You can specify either the id, the cid or an object
         * If passed an object it will attempt to get the id from the objects property specified by the model.idAttribute
         * @return Andalay.Model | undefined
         */
        get: function(obj) {
            // must specify a valid object or id
            if (obj == null) return void 0;
            return this._index[obj] || this._index[this.modelId(obj)] || this._index[obj.cid];
        },

        /**
         * Returns whether a model exists in the collection with the id.
         * @param mixed id, can be an id, cid or object
         * @see this.get()
         * @return boolean true if a model exists with the id
         */
        exists: function(id) {
            return !angular.isUndefined(this.get(id));
        },
        
        /**
         * Update the model and return it
         * @return object
         */
        update: function(model) {
            return this.addOne(model);
        },

        /**
         * Remove a model
         * @param id
         * @return the removed model or null if no model found to remove
         */
        remove: function(id) {
            var model = this.get(id);
            if (model == null)
                return null;
            this._removeReference(model);
            var index = _.indexOf(this.models, model);
            this.models.splice(index, 1);
            this.length--;   
            return model;
        },

        /**
         * Removes all models from the collection
         * @return this
         */
        removeAll: function() {
            this.reset();
            return this;
        },

        /**
         * Returns the id value of the passed in object.
         * @return mixed string | interger
         */
        modelId: function (object) {
            return object[this.model.prototype.idAttribute || 'id'];
        },

        /**
         * Get the last model in the collection
         * @return object
         */
        last: function() {
            return this.models[this.length-1];
        },
        
        /**
         * Return the model at the specified position in the array
         * @param integer index position of model
         * @returns object 
         */
        at: function(index) {
            return this.models[index];
        },
        
        /**
         * @returns Return the size of the collection
         */
        size: function() {
            return this.models.length;
        },
        
        /**
         * Get all models in the collection as array
         * @returns {Array} of models
         */
        all: function() {
            return this.models;
        },

		/**
		 * Return models with matching attributes. Useful for simple cases of filter.
		 * @param {type} attrs
		 * @param {type} first
		 * @returns {unresolved}
		 */
		where: function (attrs, first) {
			var matches = _.matches(attrs);
			return this[first ? 'find' : 'filter'](function (model) {
				return matches(model);
			});
		},
		
		/**
		 * Return the first model with matching attributes. Useful for simple cases of find.
		 * @param {type} attrs
		 * @returns {unresolved}
		 */
		findWhere: function (attrs) {
			return this.where(attrs, true);
		},
		
		sync: function() {
			return Andalay.sync.apply(this, arguments);
		},
		
		/**
		 * Fetch the default set of models for this collection, 
		 * resetting the collection when they arrive. 
		 * If reset: true is passed, the response data will be passed through the reset method instead of set.
		 * @param {type} options
		 * @returns {andalay_L10.Andalay.Collection.prototype@call;sync}
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
				collection.addMany(collection.parse(response.data));
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
         * Adds the model to the internal index (idInex)
         * this essentially makes the collection aware of the model
         * as it uses this index to search for models
         * both by its autogenerated client id and by its idAttribute if it exists and is not null
         * @return void
         */
        _addReference: function(model) {
            this._index[model.cid] = model;
            var id = this.modelId(model);
            if (id != null) this._index[id] = model;
        },

        /**
         * Removes all internal references to a model
         * @return void
         */
        _removeReference: function(model) {
            delete this._index[model.cid];
            var id = this.modelId(model);
            if (id != null) delete this._index[id];
        }
        
    };

    var methods = ['forEach', 'each', 'find', 'filter'];

    // 'each', 'map', 'collect', 'reduce', 'foldl',
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
	
	var BackendHttp = {
		create: function(){
			//model.url
		},
		update: function(){
			
		}
	};
	
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
		if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
			params.data = model.toJSON();
		}
		var httpOptions = angular.extend(params, options);
		model.saving = true;
		return $http(httpOptions);
	};
	
    /**
     * Shamelessly pinched from backbone
     * Create a subclass.
     * @static
     * @param {Object} protoProps
     * @param {Object} [staticProps]
     * @return {Function} Constructor
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