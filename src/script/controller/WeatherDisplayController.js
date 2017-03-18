define([
    "underscore",
    "json!config/application.json",
    "service/WeatherService"
], function(
    _,
    AppConfig,
    WeatherService
) {
    var interval = 10 * 60 * 1000; // 10 minutes
    var refreshPromise = null;

    var WeatherDisplayController = function($scope, $window, $timeout, $http, $sce) {
        WeatherService.$http = $http;
        WeatherService.$sce = $sce;
        WeatherService.apiKey = AppConfig.apiKey;

        $scope.showSettingsModal = false;
        $scope.preferences = {
            location: "",
            showImperial: true,
            showMetric: true,
            showSi: false
        };
        var localStorageKey = "weatherPreferences";
        function saveConfig() { $window.localStorage.setItem(localStorageKey, JSON.stringify($scope.preferences)); }
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

        $scope.wData = {};

        function handleError(feature, error) {
            console.error("Error in " + feature + " call:", error);
        }

        function sortByCountDesc(a, b) { return b.count - a.count; }

        /**
         * Chooses the elements at the front of the array that have similar counts.
         * E.g. list = [{text: "alpha", count: 5}, {text: "bravo", count: 5}, {text: "charlie": 2}, ...]
         * with tolerance == 2 this would choose just alpha and bravo because charlie's count is more than 2 less than
         * alpha's
         * @param {Array}  list        must be sorted descending by list[].count
         * @param {String} key         key to grab from elements in list for return value
         * @param {Number} tolerance   max difference between the count property of list[0] and subsequent elements that
         *                             will be considered for inclusion
         * @param {Number} maxToChoose max size of returned array
         * @return array of list[][key] objects
         */
        function chooseMostFrequentConditions(list, key, tolerance, maxToChoose) {
            var result = [list[0][key]];
            var end = Math.min(maxToChoose, list.length);
            for (var i = 1; i < end; i++) {
                if (list[i].count + tolerance >= list[0].count && result.length < maxToChoose) {
                    result.push(list[i][key]);
                } else {
                    break;
                }
            }
            return result;
        }

        function celsiusToKelvin(tempC) { return parseFloat(tempC) + 273.15; }
        /**
         * km    1 hr    1 min   1000m
         * -- x ------ x ----- x -----
         * hr   60 min   60 s    1 km
         */
        function kphToMs(speedKph) {
            return parseFloat(speedKph) * 1000 / 3600;
        }

        function getData() {
            WeatherService.getConditions($scope.preferences.location, function(data) {
                var c = $scope.wData.conditions = $scope.wData.conditions || {};
                c.location = {
                    name: data.current_observation.display_location.full,
                    zip: data.current_observation.display_location.zip
                };
                c.icon = data.current_observation.icon_url;
                c.temp = {
                    actual: {
                        imperial: data.current_observation.temp_f,
                        metric: data.current_observation.temp_c,
                        si: celsiusToKelvin(data.current_observation.temp_c)
                    },
                    feelsLike: {
                        imperial: data.current_observation.feelslike_f,
                        metric: data.current_observation.feelslike_c,
                        si: celsiusToKelvin(data.current_observation.feelslike_c)
                    }
                };
                c.wind = {
                    summary: data.current_observation.wind_string,
                    direction: data.current_observation.wind_dir,
                    speed: {
                        imperial: data.current_observation.wind_mph,
                        metric: data.current_observation.wind_kph,
                        si: kphToMs(data.current_observation.wind_kph)
                    }
                };
            }, _.partial(handleError, "conditions"));
            WeatherService.getForecast($scope.preferences.location, function(data) {
                var f = $scope.wData.forecast = $scope.wData.forecast || {};
                f.today = {
                    text: {
                        imperial: data.forecast.txt_forecast.forecastday[0].fcttext,
                        metric: data.forecast.txt_forecast.forecastday[0].fcttext_metric
                    },
                    icon: data.forecast.txt_forecast.forecastday[0].icon_url,
                    temp: {
                        low: {
                            imperial: data.forecast.simpleforecast.forecastday[0].low.fahrenheit,
                            metric: data.forecast.simpleforecast.forecastday[0].low.celsius,
                            si: celsiusToKelvin(data.forecast.simpleforecast.forecastday[0].low.celsius)
                        },
                        high: {
                            imperial: data.forecast.simpleforecast.forecastday[0].high.fahrenheit,
                            metric: data.forecast.simpleforecast.forecastday[0].high.celsius,
                            si: celsiusToKelvin(data.forecast.simpleforecast.forecastday[0].high.celsius)
                        }
                    },
                    wind: {
                        direction: data.forecast.simpleforecast.forecastday[0].avewind.dir,
                        speed: {
                            imperial: data.forecast.simpleforecast.forecastday[0].avewind.mph,
                            metric: data.forecast.simpleforecast.forecastday[0].avewind.kph,
                            si: kphToMs(data.forecast.simpleforecast.forecastday[0].avewind.kph)
                        }
                    }
                };
            }, _.partial(handleError, "forecast"));
            WeatherService.getYesterday($scope.preferences.location, function(data) {
                var h = $scope.wData.history = $scope.wData.history || {};
                h.yesterday = {
                    temp: {
                        low: {
                            imperial: data.history.dailysummary[0].mintempi,
                            metric: data.history.dailysummary[0].mintempm,
                            si: celsiusToKelvin(data.history.dailysummary[0].mintempm)
                        },
                        high: {
                            imperial: data.history.dailysummary[0].maxtempi,
                            metric: data.history.dailysummary[0].maxtempm,
                            si: celsiusToKelvin(data.history.dailysummary[0].maxtempm)
                        },
                        mean: {
                            imperial: data.history.dailysummary[0].meantempi,
                            metric: data.history.dailysummary[0].meantempm,
                            si: celsiusToKelvin(data.history.dailysummary[0].meantempm)
                        }
                    },
                    wind: {
                        direction: data.history.dailysummary[0].meanwdire,
                        speed: {
                            imperial: data.history.dailysummary[0].meanwindspdi,
                            metric: data.history.dailysummary[0].meanwindspdm,
                            si: kphToMs(data.history.dailysummary[0].meanwindspdm)
                        }
                    }
                };
                var obsConditions = {}, obsIcons = {};
                // loop through the 24 hourly observations and count how many times each one appears
                _.each(data.history.observations, function(hourlyObs) {
                    obsConditions[hourlyObs.conds] = obsConditions[hourlyObs.conds] || 0;
                    obsConditions[hourlyObs.conds]++;
                    obsIcons[hourlyObs.icon] = obsIcons[hourlyObs.icon] || 0;
                    obsIcons[hourlyObs.icon]++;
                });
                // put counts into arrays so that they can be sorted by count
                var sortedConds = [], sortedIcons = [];
                _.each(obsConditions, function(count, condition) { sortedConds.push({text: condition, count: count}); });
                sortedConds.sort(sortByCountDesc);
                _.each(obsIcons, function(count, iconName) { sortedIcons.push({iconName: iconName, count: count}); });
                sortedIcons.sort(sortByCountDesc);

                h.yesterday.texts = chooseMostFrequentConditions(sortedConds, "text", 2, 2);
                var iconName = chooseMostFrequentConditions(sortedIcons, "iconName", 2, 1)[0];
                h.yesterday.icon = "https://icons.wxug.com/i/c/k/" + iconName + ".gif";
            }, _.partial(handleError, "yesterday"));
            $timeout(getData, interval);
        }

        $scope.toggleConfigModal = function() { $scope.showSettingsModal = !$scope.showSettingsModal; };

        loadConfig();
        getData();
    };
    WeatherDisplayController.$inject = ["$scope", "$window", "$timeout", "$http", "$sce"];

    return WeatherDisplayController;
});
