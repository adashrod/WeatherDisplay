define([
    "underscore",
    "json!config/application.json",
    "json!config/revision.json",
    "model/WeatherData",
    "service/WeatherService"
], function(
    _,
    AppConfig,
    Revision,
    WeatherData,
    WeatherService
) {
    var interval = 10 * 60 * 1000; // 10 minutes

    var WeatherDisplayController = function($scope, $window, $timeout, $http) {
        WeatherService.$http = $http;
        WeatherService.apiKey = AppConfig.apiKey;
        var h = AppConfig.keyValueServerHost, kvApiPath = null;
        if (h) {
            if (h.indexOf("http://") === -1 && h.indexOf("https://") === -1) { h = "http://" + h; }
            kvApiPath = h + AppConfig.keyValueApiPath;
        }
        if (Revision) { $scope.revision = Revision.revision; }

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
        var waitingOnServerForConfig = false;
        function saveConfig() {
            if (waitingOnServerForConfig) { return; }
            $window.localStorage.setItem(localStorageKey, JSON.stringify($scope.preferences));
            $scope.currentUnitSystems = [];
            _.each($scope.preferences, function(enabled, key) {
                if (typeof enabled === "boolean" && enabled && key.substring(0, 4) === "show") {
                    $scope.currentUnitSystems.push(key.substring(4).toLowerCase());
                }
            });
            if (kvApiPath !== null) {
                $http({
                    method: "POST",
                    url: kvApiPath + "/" + localStorageKey,
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    data: JSON.stringify($scope.preferences)
                }).then(_.noop, console.error);
            }
        }
        function loadConfig() {
            function readJsonIntoScope(jsonString) {
                try {
                    // not just doing $scope.preferences = JSON.parse(s) because then things not present in local storage,
                    // i.e. new features that have never been persisted in this session, would get deleted from the scope
                    var storedPrefs = JSON.parse(jsonString);
                    _.each(storedPrefs, function(v, k) { $scope.preferences[k] = v; });
                } catch (e) {}
            }
            var s = $window.localStorage.getItem(localStorageKey);
            if (s !== null && typeof s !== "undefined" && s !== "null") {
                readJsonIntoScope(s);
            } else if (kvApiPath !== null) {
                waitingOnServerForConfig = true;
                $http({
                    method: "GET",
                    url: kvApiPath + "/" + localStorageKey,
                    transformResponse: [_.identity]
                })
                .then(function(response) {
                    waitingOnServerForConfig = false;
                    readJsonIntoScope(response.data);
                }, function(error) {
                    waitingOnServerForConfig = false;
                    if (error.status !== 404) { console.error("Failed to load data from key-value store: " + error.data); }
                });
            }
        }
        $scope.$watch("preferences.showImperial", saveConfig);
        $scope.$watch("preferences.showMetric", saveConfig);
        $scope.$watch("preferences.showSi", saveConfig);
        var prefChangeRefreshDataPromise = null;
        function onPrefsChangeRefreshData(newVal, oldVal) {
            if (newVal === oldVal) { return; }
            $timeout.cancel(prefChangeRefreshDataPromise);
            prefChangeRefreshDataPromise = $timeout(_.compose(getData, saveConfig), 6000);
        }
        $scope.$watch("preferences.location", onPrefsChangeRefreshData);
        function ensurePositive(newVal, oldVal) {
            if (newVal <= 0) { $scope.preferences.hourlyInterval = oldVal > 0 ? oldVal : 1; }
        }
        function updateHourlyFilteredData() {
            if (!gotCc || !gotHourly) { return; }
            while ($scope.hourlyModeData.pop()); // works because elements are objects- never falsy
            $scope.hourlyModeData.push(currentConditions);
            _.each(allHourlyData, function(wd, i) {
                if ((i + 1) % $scope.preferences.hourlyInterval === 0) {
                    $scope.hourlyModeData.push(wd);
                }
            });
            gotCc = false;
            gotHourly = false;
        }
        $scope.$watch("preferences.hourlyInterval", function(newVal, oldVal) {
            ensurePositive(newVal, oldVal);
            gotCc = !!currentConditions;
            gotHourly = allHourlyData.length > 0;
            updateHourlyFilteredData();
            saveConfig();
        });

        var gotCc = false, gotHourly = false;
        var currentConditions;
        var allHourlyData = [];
        $scope.hourlyModeData = [];
        $scope.dayModeData = [];
        $scope.hourlyModeApi = {};
        $scope.dayModeApi = {};

        function handleError(feature, error) {
            console.error("Error in " + feature + " call:", error);
        }

        var getDataPromise;
        function getData() {
            $timeout.cancel(getDataPromise);
            if (!$scope.preferences.location) {
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
                currentConditions = new WeatherData(data.current_observation, null, "current", new Date());
                gotCc = true;
                updateHourlyFilteredData();
            }, _.partial(handleError, "conditions"));
            WeatherService.getHourly($scope.preferences.location, function(data) {
                resetArrays();
                var now = new Date();
                allHourlyData = [];
                _.each(data.hourly_forecast, function(hourlyForecast, i) {
                    var wd = new WeatherData(hourlyForecast, null, "forecast");
                    if (i === 0) {
                        // excluding the first if it's less than half an hour in the future since that's not extremely useful
                        var keepFirst = wd.date.getTime() - now.getTime() > 30 * 60 * 1000;
                        if (!keepFirst) { return; }
                    }
                    allHourlyData.push(wd);
                });
                gotHourly = true;
                updateHourlyFilteredData();
            }, _.partial(handleError, "hourly"));
            WeatherService.getForecast($scope.preferences.location, function(data) {
                resetArrays();
                _.each(data.forecast.simpleforecast.forecastday, function(forecastDay) {
                    $scope.dayModeData.push(new WeatherData(forecastDay, null, "forecast"));
                });
            }, _.partial(handleError, "forecast"));
            WeatherService.getYesterday($scope.preferences.location, function(data) {
                resetArrays();
                var yesterdaysSummary = new WeatherData(data.history.dailysummary[0], data.history.observations, "history",
                    new Date(new Date().getTime() - 24 * 60 * 60 * 1000));
                $scope.dayModeData.unshift(yesterdaysSummary);
            }, _.partial(handleError, "yesterday"));
            getDataPromise = $timeout(getData, interval);
        }

        $scope.switchView = function() {
            if ($scope.currentView === $scope.Views.DAYS) {
                $scope.currentView = $scope.Views.HOURS;
            } else {
                $scope.currentView = $scope.Views.DAYS;
            }
        };

        $scope.resetView = function() {
            if (typeof $scope.hourlyModeApi.goToPage === "function") { $scope.hourlyModeApi.goToPage(0); }
            if (typeof $scope.dayModeApi.goToPage === "function") { $scope.dayModeApi.goToPage(1); }
        };
        $scope.toggleConfigModal = function() { $scope.showSettingsModal = !$scope.showSettingsModal; };

        $scope.previousPage = function() {
            if ($scope.currentView === $scope.Views.HOURS) {
                $scope.hourlyModeApi.previousPage && $scope.hourlyModeApi.previousPage();
            } else {
                $scope.dayModeApi.previousPage && $scope.dayModeApi.previousPage();
            }
        };
        $scope.nextPage = function() {
            if ($scope.currentView === $scope.Views.HOURS) {
                $scope.hourlyModeApi.nextPage && $scope.hourlyModeApi.nextPage();
            } else {
                $scope.dayModeApi.nextPage && $scope.dayModeApi.nextPage();
            }
        };
        $scope.hasPrevious = function() {
            if ($scope.currentView === $scope.Views.HOURS) {
                return $scope.hourlyModeApi.hasPrevious && $scope.hourlyModeApi.hasPrevious() || false;
            } else {
                return $scope.dayModeApi.hasPrevious && $scope.dayModeApi.hasPrevious() || false;
            }
        };
        $scope.hasNext = function() {
            if ($scope.currentView === $scope.Views.HOURS) {
                return $scope.hourlyModeApi.hasNext && $scope.hourlyModeApi.hasNext() || false;
            } else {
                return $scope.dayModeApi.hasNext && $scope.dayModeApi.hasNext() || false;
            }
        };

        loadConfig();
        getData();
    };
    WeatherDisplayController.$inject = ["$scope", "$window", "$timeout", "$http"];

    return WeatherDisplayController;
});
