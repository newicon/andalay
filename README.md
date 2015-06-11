# Andalay #

A data layer modelled on Backbone collection and models. For use with Angular JS.

## Website

[http://andalayjs.com](http://andalayjs.com) 
[https://github.com/newicon/andalay](https://github.com/newicon/andalay)

[http://andalayjs.com/src/andalay.js](Development source)
[http://andalayjs.com/src/andalay.js](Production source)

## Goals

- Form a data layer that syncs with a backend (default basic restful)
- Creates a local object cache reducing server load. For example a collection.find(123) request would first search the local objects in the collection and if not found would then ask the server.
- Makes working with collections of models easier
- Enables active record style objects. Each item in the collection is in fact a model that can have convenience functions
- Make it easy to locally search through collections and models

## To Develop

1. ```git clone git@bitbucket.org:newicon/angular-andalay.git```
2. ```cd angular-andalay```
3. ```npm install```

To run the tests:

- ```npm test``` - run through the tests once and exit.
- ```karma start``` - runs the tests and reruns them when any development file is changed note you will need to install karma ```npm install karma -g```



## Overview ##

Andalay Has two core objects a Collection and a Model object.
A collection represents a collection of Model objects.

Typical useage:

~~~js
// We must specify Andalay as a dependacy on the angular app
var app = angular.module('myapp', ['Andalay']);

// Andalay forms the core workhorse for many services responsible for interacting with server side and client side data
app.service('TodoService', ['Andalay', function(Andalay){
	
	var TodoModel = Andalay.Model.extend({
		// model properties and functions
	})

	var TodoCollection = Andalay.Collection.extend({
		url:'/todos',
		model:TodoModel
	});

	return new TodoCollection();

}]);
~~~

We typically only need to return the collection from the angular service as we can access the model class via the collection.model property.
However Andalay can support multiple model types in one collection. So your service might want to return these as well.


~~~js
var myNewTodo = new TodoService.model({name:'my new todo'});
~~~

To populate the collection with models we need to fetch them from the server:

~~~js
TodoService.fetch();
~~~

The above code will generate a GET /todos request and populate the collection.
We can alos populate our model with data we already have by using a reset command.

~~~
TodoService.reset([{"name":"my first model"}, {"name":"My second model"}]);
~~~

We can also do this at initialisation:
~~~
var myNewCollection = new TodoCollection([{"name":"my first model"}, {"name":"My second model"}]);
~~~

To use this in angular we can do the following:

~~~js
// in angular controller
$scope.todoService = TodoService;
$scope.todoService.fetch();
~~~

~~~html
// in html
<div ng-repeat="todo in todoService.models">
~~~

The collections model property maintains an array of models
Typically Collections and Models map to a rest style URL structures.

~~~
GET  /todos/    TodoCollection.fetch()
POST /todos/    TodoCollection.create() 
GET  /todos/1   TodoModel.fetch();
PUT  /todos/1   TodoModel.save();
DEL  /todos/1   TodoModel.destroy();
~~~

However you may not use them in this context always.
As the following code will generate the correct request to create a new Todo Model.

~~~
var myTodo = new TodoModel({name:'My new todo'});
myTodo.save();
~~~

The above code would generate a request ```POST /todos/ {name:'My new todo'}```
It is important to note that Andalay expects the server to return the newly created object.
A valid response would be: ```{"id":1, "name":"My new todo"}```

The model will now contain an id property and subsequent calls to the save method will generate a PUT request to update the model.


