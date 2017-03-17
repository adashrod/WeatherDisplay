define([
    "underscore",
    "json!config/application.json",
    "service/WeatherService"
], function(
    _,
    AppConfig,
    WeatherService
) {
    var controller = function($scope, $window, $http, $sce) {
        WeatherService.$http = $http;
        WeatherService.$sce = $sce;
        WeatherService.apiKey = AppConfig.apiKey;

        $scope.fetch = function() {
            WeatherService.getSatellite($scope.location, function(data) {
                console.log("satellite data", data);
            }, function(error) {
                console.error("satellite error", error);
            });
            WeatherService.getConditions($scope.location, function(data) {
                console.log("conditions data", data);
            }, function(error) {
                console.error("conditions error", error);
            });
            WeatherService.getAstronomy($scope.location, function(data) {
                console.log("astronomy data", data);
            }, function(error) {
                console.error("astronomy error", error);
            });
        };
    };
    controller.$inject = ["$scope", "$window", "$http", "$sce"];

    return controller;
});
