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
		attrs = _.defaults({}, attrs, angular.copy(_.result(this, 'defaults')));
		// give the model an autogenerated client id
		this.cid = _.uniqueId('c');
		if (attrs) {
			angular.extend(this, attrs);
		}
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
		 * define default attributes to set on this model
		 */
		defaults: {},

		/**
		 * Initialize is an empty function by default. Override it with your own
		 * initialization logic.
		 */
		initialize: function(){},

		toJSON: function() {
			var json = angular.copy(this);
			delete json['collection'];
			return json;
		}
	};

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
         * @param obj object the object to add
         * @param options {at:index} if the at property of options is defined then it will
         * use its value as the array index at which to insert the model. (not yet tested)
         * @return the added object as an instance of the Model
         */
        addOne: function(obj, options) {
            options = options || {};
            var id, existing, index;
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
         * @param models array of objects
         * @throw error if models param is not an array
         * @returns array of added or prexisting models
         */
        addMany: function(models, options) {
            options = options || {};
            if (!_.isArray(models)) {
                throw new Error('Cannot add ' + models + ', models must be an array of objects');
            }
            var added = [];
            for (var i = 0; i < models.length; i++) {
                var obj = models[i];
                added.push(this.addOne(obj, options));
            }
            return added;
        },

        /** 
         * When you have more items than you want to add or remove individually,
         * you can reset the entire set with a new list of models
         */
        reset: function (models) {
            this._reset();
            if (models)
                this.addMany(models);
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
         * Updates an existing object or array of objects
         * will merge if it already exists and add if it does not
         * @param mixed object | array
         * @returns array
         */
        updateMany: function(models) {
            return this.addMany(models);
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
        },
        
        /**
         * The JSON representation of a Collection is an array of the
         * models' attributes.
         * @return object that can be json-ified
         */
        toJSON: function(options) {
            var ret = [];
            for (var i = this.models.length - 1; i >= 0; i--) {
                var model = this.at(i);
                if (model) {
                    ret[i] = model.toJSON();
                }
            }
            return ret;
        }
    };

    var methods = ['forEach', 'find'];

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
    
    /**
     * Add extend function to Objects
     */
    Andalay.Model.extend = Andalay.Collection.extend = extend;

    return Andalay;
}]);