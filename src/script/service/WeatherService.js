define([
    "underscore"
], function(
    _
) {
    /**
     * keys: names of WU features made in API call, e.g. conditions
     * values: properties found in JSON responses from WU, e.g. current_observation
     * When you make an API call, the feature name goes in the URL. For some features, the data for that call is in the
     * JSON response at the key, which matches the feature name (e.g. .../api/<auth>/satellite/q/MA/Boston.json and the
     * JSON response looks like {satellite: <relevant data>, ... }); for others, the key in the response is different
     * from the feature name (one even has multiple keys). This mapping keeps track of those that are different.
     */
    var featureToPropertyMap = {
        "conditions": ["current_observation"],
        "astronomy": ["sun_phase", "moon_phase"],
        "forecast10day": ["forecast"],
        "geolookup": ["location"],
        "hourly": ["hourly_forecast"],
        "hourly10day": ["hourly_forecast"],
        "planner": ["trip"],
        "yesterday": ["history"]
    };

    var apiBaseUrl = "http://api.wunderground.com/api/";
    // these 3 need to be injected by callers
    var $http = null;
    var $sce = null;
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
                var propNamesToUse = featureToPropertyMap[featureName] || [featureName];
                _.each(callbackList, function(callbackPair) {
                    var callbackData = {};
                    if (response.data) {
                        if (response.data.response && response.data.response.error) {
                            callbackPair.error(response.data.response.error);
                            return;
                        }
                        _.each(propNamesToUse, function(p) { callbackData[p] = response.data[p]; });
                        callbackPair.success(callbackData);
                    } else {
                        callbackPair.error("Got success code: " + response.status + ", but no data back from API");
                    }
                });
            });
            resetBatch();
        }, function(error) {
            _.each(callbackRegistry, function(callbackList, featureName) {
                var propNamesToUse = featureToPropertyMap[featureName] || [featureName];
                _.each(callbackList, function(callbackPair) {
                    if (error.data) {
                        callbackPair.error(error.data.response && error.data.response.error || error.data);
                    } else {
                        callbackPair.error("Got error code: " + error.status + ", but no data back from API");
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

    WeatherServiceSingleton.getAlerts = function(location, success, error) {
        enqueueCallForBatch("alerts", location, success, error);
    };

    WeatherServiceSingleton.getAlmanac = function(location, success, error) {
        enqueueCallForBatch("almanac", location, success, error);
    };

    WeatherServiceSingleton.getAstronomy = function(location, success, error) {
        enqueueCallForBatch("astronomy", location, success, error);
    };

    WeatherServiceSingleton.getConditions = function(location, success, error) {
        enqueueCallForBatch("conditions", location, success, error);
    };

    WeatherServiceSingleton.getCurrentHurricane = function(location, success, error) {
        enqueueCallForBatch("currenthurricane", location, success, error);
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

    WeatherServiceSingleton.getHistory = function(location, success, error) {
        enqueueCallForBatch("history", location, success, error);
    };

    WeatherServiceSingleton.getHourly = function(location, success, error) {
        enqueueCallForBatch("hourly", location, success, error);
    };

    WeatherServiceSingleton.getHourly10Day = function(location, success, error) {
        enqueueCallForBatch("hourly10day", location, success, error);
    };

    WeatherServiceSingleton.getPlanner = function(location, success, error) {
        enqueueCallForBatch("planner", location, success, error);
    };

    WeatherServiceSingleton.getRawTide = function(location, success, error) {
        enqueueCallForBatch("rawtide", location, success, error);
    };

    WeatherServiceSingleton.getSatellite = function(location, success, error) {
        enqueueCallForBatch("satellite", location, success, error);
    };

    WeatherServiceSingleton.getTide = function(location, success, error) {
        enqueueCallForBatch("tide", location, success, error);
    };

    WeatherServiceSingleton.getWebcams = function(location, success, error) {
        enqueueCallForBatch("webcams", location, success, error);
    };

    WeatherServiceSingleton.getYesterday = function(location, success, error) {
        enqueueCallForBatch("yesterday", location, success, error);
    };

    Object.defineProperties(WeatherServiceSingleton, {
        $http: {
            set: function(h) {
                $http = h;
            }
        },
        $sce: {
            set: function(s) {
                $sce = s;
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
