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
            showSi: false,
            hourlyInterval: 1
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
                if (s !== null && typeof s !== "undefined" && s !== "null") {
                    // not just doing $scope.preferences = JSON.parse(s) because then things not present in local storage,
                    // i.e. new features that have never been persisted in this session, would get deleted from the scope
                    var storedPrefs = JSON.parse(s);
                    _.each(storedPrefs, function(v, k) { $scope.preferences[k] = v; });
                }
            } catch (e) {}
        }
        $scope.$watch("preferences.showImperial", saveConfig);
        $scope.$watch("preferences.showMetric", saveConfig);
        $scope.$watch("preferences.showSi", saveConfig);
        var prefChangeRefreshDataPromise = null;
        function onPrefsChangeRefreshData() {
            $timeout.cancel(prefChangeRefreshDataPromise);
            prefChangeRefreshDataPromise = $timeout(_.compose(getData, saveConfig), 2000);
        }
        $scope.$watch("preferences.location", onPrefsChangeRefreshData);
        function ensurePositive(newVal, oldVal) {
            if (newVal <= 0) { $scope.preferences.hourlyInterval = oldVal > 0 ? oldVal : 1; }
        }
        $scope.$watch("preferences.hourlyInterval", _.compose(onPrefsChangeRefreshData, ensurePositive));

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
                var offset;
                _.each(data.hourly_forecast, function(hourlyForecast, i) {
                    var wd = new WeatherData(hourlyForecast, "forecast");
                    if (i === 0) {
                        // excluding the first if it's less than half an hour in the future since that's not extremely useful
                        var keepFirst = wd.date.getTime() - now.getTime() > 30 * 60 * 1000;
                        offset = keepFirst ? 1 : 0;
                        if (!keepFirst) { return; }
                    }
                    if ((i + offset) % $scope.preferences.hourlyInterval === 0) {
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

        $scope.resetView = function() { $scope.currentView = $scope.Views.HOURS; };

        $scope.toggleConfigModal = function() { $scope.showSettingsModal = !$scope.showSettingsModal; };

        loadConfig();
        getData();
    };
    WeatherDisplayController.$inject = ["$scope", "$window", "$timeout", "$http", "$sce"];

    return WeatherDisplayController;
});
