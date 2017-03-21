define([
    "underscore",
    "controller/WeatherDisplayController",
    "directive/WeatherPage",
    "filter/TruncatedFloat"
], function(
    _,
    WeatherDisplayController,
    WeatherPage,
    TruncatedFloat
) {
    var appName = "weatherDisplay";
    _.noConflict();
    var angular = window.angular;
    var app = angular.module(appName, []);

    app.controller("WeatherDisplayController", WeatherDisplayController);
    app.directive("weatherPage", WeatherPage);
    app.filter("truncatedFloat", TruncatedFloat);

    try {
        angular.bootstrap(window.document, [appName]);
        console.info(appName + " bootstrapped", app, angular.element(window.document).scope());
    } catch (e) {
        // just in case Firefox swallows the error
        console.error("Error bootstrapping:", e);
    }
});
