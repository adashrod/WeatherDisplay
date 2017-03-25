define([
    "underscore",
    "json!config/application.json",
    "model/WeatherData",
    "service/WeatherService"
], function(
    _,
    AppConfig,
    WeatherData,
    WeatherService
) {
    var interval = 10 * 60 * 1000; // 10 minutes
    var refreshPromise = null;

    var WeatherDisplayController = function($scope, $window, $timeout, $http, $sce) {
        WeatherService.$http = $http;
        WeatherService.$sce = $sce;
        WeatherService.apiKey = AppConfig.apiKey;

        $scope.showSettingsModal = false;
        $scope.Views = { DAYS: "days", HOURS: "hours" };
        $scope.currentView = $scope.Views.HOURS;
        $scope.preferences = {
            location: "",
            showImperial: true,
            showMetric: true,
            showSi: false
        };
        $scope.currentUnitSystems = [];
        var localStorageKey = "weatherPreferences";
        function saveConfig() {
            $window.localStorage.setItem(localStorageKey, JSON.stringify($scope.preferences));
            $scope.currentUnitSystems = [];
            _.each($scope.preferences, function(enabled, key) {
                if (typeof enabled === "boolean" && enabled && key.substring(0, 4) === "show") {
                    $scope.currentUnitSystems.push(key.substring(4).toLowerCase());
                }
            });
        }
        function loadConfig() {
            try {
                var s = $window.localStorage.getItem(localStorageKey);
                if (s !== null && typeof s !== "undefined" && s !== "null") { $scope.preferences = JSON.parse(s); }
            } catch (e) {}
        }
        $scope.$watch("preferences.showImperial", saveConfig);
        $scope.$watch("preferences.showMetric", saveConfig);
        $scope.$watch("preferences.showSi", saveConfig);
        var locationUpdatePromise = null;
        $scope.$watch("preferences.location", function() {
            $timeout.cancel(locationUpdatePromise);
            locationUpdatePromise = $timeout(_.compose(getData, saveConfig), 2000);
        });

        $scope.hourlyModeData = [];
        $scope.dayModeData = [];

        function handleError(feature, error) {
            console.error("Error in " + feature + " call:", error);
        }

        function getData() {
            if (!$scope.preferences.location) {
                alert("You must open preferences and specify a location");
                return;
            }
            var didReset = false;
            /**
             * Clears the data in the arrays, assuring that they only get cleared once. Called from inside the AJAX
             * callbacks to ensure that the display isn't blank while requests are in flight.
             */
            function resetArrays() {
                if (!didReset) {
                    $scope.hourlyModeData = [];
                    $scope.dayModeData = [];
                    didReset = true;
                }
            }
            WeatherService.getConditions($scope.preferences.location, function(data) {
                resetArrays();
                $scope.location = {
                    name: data.current_observation.display_location.full,
                    zip: data.current_observation.display_location.zip
                };
                var currentConditions = new WeatherData(data.current_observation, "current", new Date());
                $scope.hourlyModeData.unshift(currentConditions);
            }, _.partial(handleError, "conditions"));
            WeatherService.getHourly($scope.preferences.location, function(data) {
                resetArrays();
                var now = new Date();
                _.each(data.hourly_forecast, function(hourlyForecast) {
                    var wd = new WeatherData(hourlyForecast, "forecast");
                    // excluding the first if it's less than half an hour in the future since that's not extremely useful
                    if (wd.date.getTime() - now.getTime() > 30 * 60 * 1000) {
                        $scope.hourlyModeData.push(wd);
                    }
                });
            }, _.partial(handleError, "hourly"));
            WeatherService.getForecast($scope.preferences.location, function(data) {
                resetArrays();
                _.each(data.forecast.simpleforecast.forecastday, function(forecastDay) {
                    $scope.dayModeData.push(new WeatherData(forecastDay, "forecast"));
                });
            }, _.partial(handleError, "forecast"));
            WeatherService.getYesterday($scope.preferences.location, function(data) {
                resetArrays();
                var yesterdaysSummary = new WeatherData(data.history.dailysummary[0], "history", new Date(new Date().getTime() - 24 * 60 * 60 * 1000));
                yesterdaysSummary.setIcon(data.history.observations);
                yesterdaysSummary.setTextSummary(data.history.observations);
                $scope.dayModeData.unshift(yesterdaysSummary);
            }, _.partial(handleError, "yesterday"));
            $timeout(getData, interval);
        }

        $scope.nextView = function() {
            if ($scope.currentView === $scope.Views.DAYS) {
                $scope.currentView = $scope.Views.HOURS;
            } else {
                $scope.currentView = $scope.Views.DAYS;
            }
        };

        $scope.toggleConfigModal = function() { $scope.showSettingsModal = !$scope.showSettingsModal; };

        loadConfig();
        getData();
    };
    WeatherDisplayController.$inject = ["$scope", "$window", "$timeout", "$http", "$sce"];

    return WeatherDisplayController;
});
