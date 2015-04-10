# Andalay #

A data layer modelled on Backbone collection and models. For use with Angular JS.

## Website

[http://andalayjs.com](http://andalayjs.com)

## Goals

- Form a data layer that syncs with a backend (restfull or otherwise, the way browsers are going it wouldnt be surprising to have a local database type object in the future that does this for us, in which case Andalay might form a default standard interface perhaps)
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




