define([
    "underscore",
    "model/Alert",
    "model/Location",
    "model/SunMoonPhase",
    "model/WeatherData"
], function(
    _,
    Alert,
    Location,
    SunMoonPhase,
    WeatherData
) {
    /**
     * Each descriptor is an array. Each element in that array is an API callback arg factory, that determines what to
     * pass to the API callback, i.e. if descriptor.length === 3, the callback to the WeatherService API will get three
     * arguments, each built by that object.
     * The API callback arg factory has an array: factoryArgDescriptors. Each element is an array of property names to
     * be dereferenced on the response data, then passed to the factory function (factoryArgDescriptors.length ===
     * factory.length.
     * Finally the return value of factory() is the argument that will be passed to the API callback
     */
    var descriptors = {
        conditions: [{
            factoryArgDescriptors: [["current_observation"]],
            factory: function(currentObservation) {
                return new WeatherData(currentObservation, null, "current", new Date());
            }
        }, {
            factoryArgDescriptors: [["current_observation", "display_location"]],
            factory: function(displayLocation) {
                return new Location(displayLocation.full, displayLocation.zip);
            }
        }],
        hourly: [{
            factoryArgDescriptors: [["hourly_forecast"]],
            factory: function(hFcstArray) {
                return _.map(hFcstArray, function(hFcst) {
                    return new WeatherData(hFcst, null, "forecast");
                });
            }
        }],
        forecast: [{
            factoryArgDescriptors: [["forecast", "simpleforecast", "forecastday"]],
            factory: function(fcstArray) {
                return _.map(fcstArray, function(fcst) {
                    return new WeatherData(fcst, null, "forecast")
                });
            }
        }],
        yesterday: [{
            factoryArgDescriptors: [["history", "dailysummary", 0], ["history", "observations"]],
            factory: function(yFst, ySnd) {
                return new WeatherData(yFst, ySnd, "history", new Date(new Date().getTime() - 24 * 60 * 60 * 1000));
            }
        }],
        geolookup: [{
            factoryArgDescriptors: [["location"]],
            factory: function(locationData) {
                return new Location(locationData.city, locationData.zip);
            }
        }],
/*        planner: [{
            factoryArgDescriptors: [["trip"]],
            factory: function(trip) {
                new WeatherData(trip, null, "planner?"); // ?
                new PlannerData() // ?
            }
        }],*/
        alerts: [{
            factoryArgDescriptors: [["alerts"]],
            factory: function(alerts) {
                return _.map(alerts, function(alert) { return new Alert(alert); });
            }
        }],
        astronomy: [{
            factoryArgDescriptors: [["sun_phase"], ["moon_phase"]],
            factory: function(sunPhaseData, moonPhaseData) {
                return new SunMoonPhase(sunPhaseData, moonPhaseData);
            }
        }]
    };
    descriptors.history = descriptors.yesterday;
    descriptors.forecast10day = descriptors.forecast;
    descriptors.hourly10day = descriptors.hourly;

    var apiBaseUrl = "http://api.wunderground.com/api/";
    // these 2 need to be injected by callers
    var $http = null;
    var apiKey = null;

    // zip code, country & city, US state & city, etc. See WU for more
    var currentLocation = null;
    var batchTimeout = null;
    var batchCalls = [];
    /**
     * keys: WU features. e.g. alerts, conditions
     * values: array of objects, each containing
     *     success: function to callback on success
     *     error: function to callback on error
     */
    var callbackRegistry = {};

    function makeBatchCall() {
        function resetBatch() {
            // reset all data after the batch call has finished
            batchTimeout = null;
            batchCalls = [];
            currentLocation = null;
            callbackRegistry = {};
        }
        batchCalls = _.uniq(batchCalls);

        var url = apiBaseUrl + apiKey + "/" + batchCalls.join("/") + "/q/" + currentLocation + ".json";
        $http.get(url).then(function(response) {
            _.each(callbackRegistry, function(callbackList, featureName) {
                var featureNameWithoutDates = featureName, match;
                if (match = featureNameWithoutDates.match(/(history|planner)_\d{8}/)) {
                    featureNameWithoutDates = match[1];
                }
                _.each(callbackList, function(callbackPair) {
                    if (response.data) {
                        if (response.data.response && response.data.response.error) {
                            callbackPair.error(response.data.response.error);
                            return;
                        }
                        var descriptor = descriptors[featureNameWithoutDates];
                        if (descriptor) {
                            var callbackArgs = _.map(descriptor, function(apiCbArgFactory) {
                                var factoryArgs = _.map(apiCbArgFactory.factoryArgDescriptors, function(factoryArgDesc) {
                                    var ctx = response.data;
                                    _.each(factoryArgDesc, function(name) { ctx = ctx[name]; });
                                    return ctx;
                                });
                                return apiCbArgFactory.factory.apply(null, factoryArgs);
                            });
                            callbackPair.success.apply(null, callbackArgs);
                        } else {
                            callbackPair.error("Not implemented: data mapping for feature: " + featureNameWithoutDates);
                        }
                    } else {
                        callbackPair.error("Got success code: " + response.status + ", but no data back from API");
                    }
                });
            });
            resetBatch();
        }, function(error) {
            // annoying edge case: with at least some client errors, the API responds with a useful JSON error, but
            // changes the Access-Control-Allow-Origin header to http://www.wunderground.com instead of *, causing the
            // browser to not parse the response, and error.data will be null
            _.each(callbackRegistry, function(callbackList, featureName) {
                var featureNameWithoutDates = featureName, match;
                if (match = featureNameWithoutDates.match(/(history|planner)_\d{8}/)) {
                    featureNameWithoutDates = match[1];
                }
                _.each(callbackList, function(callbackPair) {
                    if (error.data) {
                        callbackPair.error(error.data.response && error.data.response.error || error.data);
                    } else {
                        callbackPair.error("Got error code: " + error.status + ", but no data back from API (check headers)");
                    }
                });
            });
            resetBatch();
        });
    }

    function enqueueCallForBatch(feature, location, success, error) {
        if (batchTimeout === null) { batchTimeout = setTimeout(makeBatchCall, 0); }
        if (currentLocation === null) {
            currentLocation = location;
        } else if (location !== currentLocation) {
            throw new Error("Tried to get data on a different location from a previous call. All data in batched calls must come from the same location.");
        }
        batchCalls.push(feature);
        callbackRegistry[feature] = callbackRegistry[feature] || [];
        callbackRegistry[feature].push({success: success, error: error});
    }

    var WeatherServiceSingleton = {};

    /**
     * @param {function(Array.<Alert>)} success
     */
    WeatherServiceSingleton.getAlerts = function(location, success, error) {
        enqueueCallForBatch("alerts", location, success, error);
    };

    WeatherServiceSingleton.getAstronomy = function(location, success, error) {
        enqueueCallForBatch("astronomy", location, success, error);
    };

    /**
     * @param {function(WeatherData, Location)} success 1st param is the current conditions, 2nd is a Location object
     */
    WeatherServiceSingleton.getConditions = function(location, success, error) {
        enqueueCallForBatch("conditions", location, success, error);
    };

    WeatherServiceSingleton.getForecast = function(location, success, error) {
        enqueueCallForBatch("forecast", location, success, error);
    };

    WeatherServiceSingleton.getForecast10Day = function(location, success, error) {
        enqueueCallForBatch("forecast10day", location, success, error);
    };

    WeatherServiceSingleton.getGeoLookup = function(location, success, error) {
        enqueueCallForBatch("geolookup", location, success, error);
    };

    WeatherServiceSingleton.getHistory = function(location, date, success, error) {
        var dateString;
        if (typeof date === "string") {
            dateString = date;
        } else if (Object.prototype.toString.call(date) === "[object Date]") {
            dateString = date.getUTCFullYear().toString() + padWithZero(date.getUTCMonth() + 1) + padWithZero(date.getUTCDate());
        } else {
            throw new Error("2nd argument to getHistory must be a Date or a string, formatted \"yyyyMMdd\"");
        }
        enqueueCallForBatch("history_" + dateString, location, success, error);
    };

    /**
     * @param {function(Array.<WeatherData>)} success
     */
    WeatherServiceSingleton.getHourly = function(location, success, error) {
        enqueueCallForBatch("hourly", location, success, error);
    };

    WeatherServiceSingleton.getHourly10Day = function(location, success, error) {
        enqueueCallForBatch("hourly10day", location, success, error);
    };

    WeatherServiceSingleton.getPlanner = function(location, dateStart, dateEnd, success, error) {
        var dateStartString, dateEndString;
        if (typeof dateStart === "string") {
            dateStartString = dateStart;
        } else if (Object.prototype.toString.call(dateStart) === "[object Date]") {
            dateStartString = padWithZero(dateStart.getUTCMonth() + 1) + padWithZero(dateStart.getUTCDate());
        } else {
            throw new Error("2nd argument to getPlanner must be either a Date or a string, formatted \"MMdd\"");
        }
        if (typeof dateEnd === "string") {
            dateEndString = dateEnd;
        } else if (Object.prototype.toString.call(dateEnd) === "[object Date]") {
            dateEndString = padWithZero(dateEnd.getUTCMonth() + 1) + padWithZero(dateEnd.getUTCDate());
        } else {
            throw new Error("2nd argument to getPlanner must be either a Date or a string, formatted \"MMdd\"");
        }
        enqueueCallForBatch("planner_" + dateStartString + dateEndString, location, success, error);
    };

    WeatherServiceSingleton.getYesterday = function(location, success, error) {
        enqueueCallForBatch("yesterday", location, success, error);
    };

    function padWithZero(number) {
        if (number < 10) { return "0" + number; }
        return number.toString();
    }

    Object.defineProperties(WeatherServiceSingleton, {
        $http: {
            set: function(h) {
                $http = h;
            }
        },
        apiKey: {
            set: function(a) {
                apiKey = a;
            }
        }
    });

    return WeatherServiceSingleton;
});
