define([
    "underscore",
    "json!config/application.json",
    "json!config/revision.json",
    "service/WeatherService"
], function(
    _,
    AppConfig,
    Revision,
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
        $scope.currentViewHourly = true;
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
        var firstLoad = true;
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
            function goToToday() {
                if (firstLoad) {
                    console.log("goToToday", firstLoad, $scope.dayModeData.length);
                    $timeout(function() {
                        $scope.dayModeApi.goToPage(1);
                        firstLoad = false;
                    }, 1);
                }
            }
            var firstForecastLoaded = false, firstYesterdayLoaded = false;
            function forecastLoaded() {
                firstForecastLoaded = true;
                if (firstYesterdayLoaded) {
                    goToToday();
                }
            }
            function yesterdayLoaded() {
                firstYesterdayLoaded = true;
                if (firstForecastLoaded) {
                    goToToday();
                }
            }
            WeatherService.getConditions($scope.preferences.location, function(conditionsWd, location) {
                resetArrays();
                $scope.location = location;
                currentConditions = conditionsWd;
                gotCc = true;
                updateHourlyFilteredData();
            }, _.partial(handleError, "conditions"));
            WeatherService.getHourly($scope.preferences.location, function(hourlyWd) {
                resetArrays();
                var now = new Date();
                allHourlyData = [];
                // excluding the first if it's less than half an hour in the future since that's not extremely useful
                var keepFirst = hourlyWd[0].date.getTime() - now.getTime() > 30 * 60 * 1000;
                allHourlyData = keepFirst ? hourlyWd : hourlyWd.slice(1);
                gotHourly = true;
                updateHourlyFilteredData();
            }, _.partial(handleError, "hourly"));
            WeatherService.getForecast($scope.preferences.location, function(forecastWd) {
                resetArrays();
                $scope.dayModeData = forecastWd;
                forecastLoaded();
            }, _.partial(handleError, "forecast"));
            WeatherService.getYesterday($scope.preferences.location, function(yesterdayWd) {
                resetArrays();
                $scope.dayModeData.unshift(yesterdayWd);
                yesterdayLoaded();
            }, _.partial(handleError, "yesterday"));
            getDataPromise = $timeout(getData, interval);
        }

        $scope.resetView = function() {
            if (typeof $scope.hourlyModeApi.goToPage === "function") { $scope.hourlyModeApi.goToPage(0); }
            if (typeof $scope.dayModeApi.goToPage === "function") { $scope.dayModeApi.goToPage(1); }
        };
        $scope.toggleConfigModal = function() { $scope.showSettingsModal = !$scope.showSettingsModal; };

        $scope.previousPage = function() {
            if ($scope.currentViewHourly) {
                $scope.hourlyModeApi.previousPage && $scope.hourlyModeApi.previousPage();
            } else {
                $scope.dayModeApi.previousPage && $scope.dayModeApi.previousPage();
            }
        };
        $scope.nextPage = function() {
            if ($scope.currentViewHourly) {
                $scope.hourlyModeApi.nextPage && $scope.hourlyModeApi.nextPage();
            } else {
                $scope.dayModeApi.nextPage && $scope.dayModeApi.nextPage();
            }
        };
        $scope.hasPrevious = function() {
            if ($scope.currentViewHourly) {
                return $scope.hourlyModeApi.hasPrevious && $scope.hourlyModeApi.hasPrevious() || false;
            } else {
                return $scope.dayModeApi.hasPrevious && $scope.dayModeApi.hasPrevious() || false;
            }
        };
        $scope.hasNext = function() {
            if ($scope.currentViewHourly) {
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
