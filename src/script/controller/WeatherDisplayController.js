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

    var WeatherDisplayController = function($scope, $timeout, $http, $sce) {
        WeatherService.$http = $http;
        WeatherService.$sce = $sce;
        WeatherService.apiKey = AppConfig.apiKey;

        $scope.location = "02446";
        $scope.wData = {};

        function handleError(feature, error) {
            console.error("Error in " + feature + " call:", error);
        }

        function sortByCountDesc(a, b) { return b.count - a.count; }

        /**
         * Chooses the elements at the front of the array that have similar counts.
         * E.g. list = [{text: "alpha", count: 5}, {text: "bravo", count: 5}, {text: "charlie": 2}, ...]
         * with tolerance == 2 this would choose just the first because the third count is more than 2 less than the
         * first count
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

        function getData() {
            WeatherService.getConditions($scope.location, function(data) {
                var c = $scope.wData.conditions = $scope.wData.conditions || {};
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
                }
            }, _.partial(handleError, "conditions"));
            WeatherService.getForecast($scope.location, function(data) {
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
                    }
                };
            }, _.partial(handleError, "forecast"));
            WeatherService.getYesterday($scope.location, function(data) {
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
        getData();
    };
    WeatherDisplayController.$inject = ["$scope", "$timeout", "$http", "$sce"];

    return WeatherDisplayController;
});
