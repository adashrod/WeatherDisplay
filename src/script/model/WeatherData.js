define([
    "underscore"
], function(
    _
) {
    var iconPattern = /https?:\/\/icons.wxug.com\/i\/c\/\w+\/(\w+).gif/;

    /**
     * A container for temperature and wind data. Properties include
     * temperature (TemperatureData)
     * wind (WindData)
     * humidity (HumidityData)
     * precipitation (PrecipitationData)
     * icon (String) icon url
     * summary (String)
     * type (String)
     * date (Date)
     */
    function WeatherData(rawData, periodicObservations, type, date) {
        var _temperatureData = new TemperatureData(rawData);
        var _windData = new WindData(rawData);
        var _humidityData = new HumidityData(rawData, periodicObservations);
        var _precipitationData = new PrecipitationData(rawData);
        if (_windData.summary === null && _windData.direction === null && _windData.speed === null) { _windData = null; }
        var _icon = null, _summary = null, _type = type.toString(), _date = null;
        // conditions, forecast, hourly forecast
        if (rawData.icon_url) {
            var m = rawData.icon_url.match(iconPattern);
            if (m) { _icon = "https://icons.wxug.com/i/c/v4/" + m[1] + ".svg"; }
        }
        // forecast
        if (rawData.date && rawData.date.epoch) {
            _date = new Date(parseInt(rawData.date.epoch) * 1000);
        }
        if (rawData.FCTTIME && rawData.FCTTIME && rawData.FCTTIME.epoch) {
            _date = new Date(parseInt(rawData.FCTTIME.epoch) * 1000);
        }
        if (_.isDate(date)) { _date = date; }

        // hourly forecast
        if (rawData.condition) { _summary = rawData.condition; }
        // day forecast
        if (rawData.conditions) { _summary = rawData.conditions; }
        // conditions
        if (rawData.weather) { _summary = rawData.weather; }

        function _iterateObservations() {
            if (!periodicObservations || !periodicObservations.length) { return; }
            // used by setIcon and setTextSummary for getting text and icon from aggregate data
            var sortedConds = [], sortedIcons = [];
            var obsConditions = {}, obsIcons = {};
            // loop through the 24 hourly observations and count how many times each one appears
            _.each(periodicObservations, function(hourlyObs) {
                obsConditions[hourlyObs.conds] = obsConditions[hourlyObs.conds] || 0;
                obsConditions[hourlyObs.conds]++;
                obsIcons[hourlyObs.icon] = obsIcons[hourlyObs.icon] || 0;
                obsIcons[hourlyObs.icon]++;
            });
            // put counts into arrays so that they can be sorted by count
            _.each(obsConditions, function(count, condition) { sortedConds.push({text: condition, count: count}); });
            sortedConds.sort(sortByCountDesc);
            _.each(obsIcons, function(count, iconName) { sortedIcons.push({iconName: iconName, count: count}); });
            sortedIcons.sort(sortByCountDesc);

            var iconName = chooseMostFrequentConditions(sortedIcons, "iconName", 2, 1)[0];
            _icon = "https://icons.wxug.com/i/c/v4/" + iconName + ".svg";
            var summaries = chooseMostFrequentConditions(sortedConds, "text", 2, 2);
            _summary = summaries.join(" / ");
        }

        _iterateObservations();

        Object.defineProperties(this, {
            temperature: {
                get: function() { return _temperatureData; },
                enumerable: true
            },
            wind: {
                get: function() { return _windData; },
                enumerable: true
            },
            humidity: {
                get: function() { return _humidityData; },
                enumerable: true
            },
            precipitation: {
                get: function() { return _precipitationData; },
                enumerable: true
            },
            icon: {
                get: function() { return _icon; },
                enumerable: true
            },
            summary: {
                get: function() { return _summary; },
                enumerable: true
            },
            type: {
                get: function() { return _type; },
                enumerable: true
            },
            date: {
                get: function() { return _date; },
                enumerable: true
            }
        });
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

    function fahrenheitToCelsius(f) { return 5 * (parseFloat(f) - 32) / 9; }
    function celsiusToKelvin(c) { return parseFloat(c) + 273.15; }
    /**
     * converts miles/hour to kilometers/hour
     * mi   1 km      1 m     2.54 cm   12 in   5280 ft
     *    × ------ × ------ × ------- × ----- × -------
     *      1000 m   100 cm    1 in      1 ft     1 mi
     */
    function mphToKph(speedMph) {
        return 2.54 * 12 * 5280 * speedMph / 100000;
    }

    /**
     * converts kilometers/hour to meters/second
     * km    1 hr    1 min   1000m
     * -- × ------ × ----- × -----
     * hr   60 min   60 s    1 km
     */
    function kphToMs(speedKph) {
        return parseFloat(speedKph) * 1000 / 3600;
    }

    function inchToCm(lengthInches) {
        return 2.54 * lengthInches;
    }

    function cmToM(lengthCm) {
        return lengthCm / 100;
    }

    function mmToCm(lengthMm) {
        return lengthMm / 10;
    }

    /**
     * A container for various kinds of temperature data. Properties include (if applicable):
     * current.actual
     * current.feelsLike
     * low
     * high
     * average
     * Each of these is of type Temperature
     */
    function TemperatureData(rawData) {
        var _currentActual = null, _currentFeelsLike = null, _current = null, _low = null, _high = null, _average = null;

        // conditions
        if (rawData.temp_f) {
            _currentActual = new Temperature(rawData.temp_f, rawData.temp_c);
            _current = {};
        }
        if (rawData.feelslike_f) {
            _currentFeelsLike = new Temperature(rawData.feelslike_f, rawData.feelslike_c);
            _current = {};
        }
        // hourly forecast
        if (rawData.temp && rawData.temp.english) {
            _currentActual = new Temperature(rawData.temp.english, rawData.temp.metric);
            _current = {};
        }
        if (rawData.feelslike && rawData.feelslike.english) {
            _currentFeelsLike = new Temperature(rawData.feelslike.english, rawData.feelslike.metric);
            _current = {};
        }
        // forecast
        if (rawData.low && rawData.low.fahrenheit) {
            _low = new Temperature(rawData.low.fahrenheit, rawData.low.celsius);
        }
        if (rawData.high && rawData.high.fahrenheit) {
            _high = new Temperature(rawData.high.fahrenheit, rawData.high.celsius);
        }
        // history
        if (rawData.mintempi) {
            _low = new Temperature(rawData.mintempi, rawData.mintempm);
        }
        if (rawData.maxtempi) {
            _high = new Temperature(rawData.maxtempi, rawData.maxtempm);
        }
        if (rawData.meantempi) {
            _average = new Temperature(rawData.meantempi, rawData.meantempm);
        }

        if (_current !== null) {
            Object.defineProperties(_current, {
                actual: {
                    get: function() { return _currentActual; },
                    enumerable: true
                },
                feelsLike: {
                    get: function() { return _currentFeelsLike; },
                    enumerable: true
                }
            });
        }
        Object.defineProperties(this, {
            current: {
                get: function() { return _current; },
                enumerable: true
            },
            low: {
                get: function() { return _low; },
                enumerable: true
            },
            high: {
                get: function() { return _high; },
                enumerable: true
            },
            average: {
                get: function() { return _average; },
                enumerable: true
            }
        });
    }

    /**
     * A container for a temperature in 3 scales: Fahrenheit, Celsius, and Kelvin. Available properties are imperial,
     * metric, and si
     * @param {String|Number} imperial a Fahrenheit temp
     * @param {String|Number} metric   a Celsius temp (if absent, Celsius will be calculated from Fahrenheit input)
     */
    function Temperature(imperial, metric) {
        var _imperial = parseFloat(imperial);
        var _metric = metric && parseFloat(metric) || fahrenheitToCelsius(_imperial);
        var _si = celsiusToKelvin(_metric);

        Object.defineProperties(this, {
            imperial: {
                get: function() { return _imperial; },
                enumerable: true
            },
            metric: {
                get: function() { return _metric; },
                enumerable: true
            },
            si: {
                get: function() { return _si; },
                enumerable: true
            }
        });
    }

    /**
     * A container for wind conditions. Properties include:
     * summary (String) (not always included)
     * direction (String)
     * speed (Speed)
     */
    function WindData(rawData) {
        var _summary = null, _direction = null, _speed = null;

        // conditions
        if (rawData.wind_string) {
            _summary = rawData.wind_string;
        }
        if (rawData.wind_mph) {
            _speed = new Speed(rawData.wind_mph, rawData.wind_kph);
        }
        if (rawData.wind_dir) {
            _direction = rawData.wind_dir;
        }

        // forecast
        if (rawData.avewind && rawData.avewind.mph) {
            _speed = new Speed(rawData.avewind.mph, rawData.avewind.kph);
        }
        if (rawData.avewind && rawData.avewind.dir) {
            _direction = rawData.avewind.dir;
        }

        // hourly forecast
        if (rawData.wspd && rawData.wspd.english) {
            _speed = new Speed(rawData.wspd.english, rawData.wspd.metric);
        }
        if (rawData.wdir && rawData.wdir.dir) {
            _direction = rawData.wdir.dir;
        }

        // history
        if (rawData.meanwindspdi) {
            _speed = new Speed(rawData.meanwindspdi, rawData.meanwindspdm);
        }
        if (rawData.meanwdire) {
            _direction = rawData.meanwdire;
        }

        Object.defineProperties(this, {
            summary: {
                get: function() { return _summary; },
                enumerable: true
            },
            direction: {
                get: function() { return _direction; },
                enumerable: true
            },
            speed: {
                get: function() { return _speed; },
                enumerable: true
            }
        });
    }

    function Speed(imperial, metric) {
        var _imperial = parseFloat(imperial);
        var _metric = metric && parseFloat(metric) || mphToKph(_imperial);
        var _si = kphToMs(_metric);
        if (_imperial < 0) { _imperial = 0; }
        if (_metric < 0) { _metric = 0; }
        if (_si < 0) { _si = 0; }

        Object.defineProperties(this, {
            imperial: {
                get: function() { return _imperial; },
                enumerable: true
            },
            metric: {
                get: function() { return _metric; },
                enumerable: true
            },
            si: {
                get: function() { return _si; },
                enumerable: true
            }
        });
    }

    var percentagePattern = /(\d+)%?/;
    function HumidityData(rawData, periodicObservations) {
        var _current = null, _minimum = null, _maximum = null, _average = null;

        // conditions
        if (rawData.relative_humidity) {
            var m = rawData.relative_humidity.match(percentagePattern);
            _current = parseInt(m[1], 10);
        }

        // hourly forecast
        if (rawData.humidity) {
            _current = parseInt(rawData.humidity, 10);
        }

        // day forecast
        if (typeof rawData.minhumidity === "number") { _minimum = rawData.minhumidity; }
        if (typeof rawData.maxhumidity === "number") { _maximum = rawData.maxhumidity; }
        if (typeof rawData.avehumidity === "number") { _average = rawData.avehumidity; }

        // history
        if (periodicObservations && periodicObservations.length && periodicObservations[0].hum) {
            var totalHumidity = 0;
            _.each(periodicObservations, function(obs) {
                totalHumidity += parseFloat(obs.hum, 10);
            });
            _average = totalHumidity / periodicObservations.length;
            _current = null; // sometimes (inconsistently) the yesterday data has rawData.humidity, which is equal to
            // the average of what's in observations (redundant)
        }

        Object.defineProperties(this, {
            current: {
                get: function() { return _current; },
                enumerable: true
            },
            minimum: {
                get: function() { return _minimum; },
                enumerable: true
            },
            maximum: {
                get: function() { return _maximum; },
                enumerable: true
            },
            average: {
                get: function() { return _average; },
                enumerable: true
            }
        });
    }

    function PrecipitationData(rawData) {
        var _rain = null, _snow = null;

        // forecast
        if (rawData.qpf_allday && typeof rawData.qpf_allday.in === "number") {
            _rain = new Precipitation(rawData.qpf_allday.in, null, rawData.qpf_allday.mm);
        }
        if (rawData.snow_allday && typeof rawData.snow_allday.in === "number") {
            _snow = new Precipitation(rawData.snow_allday.in, rawData.snow_allday.cm, null);
        }

        // yesterday
        if (rawData.precipi) {
            _rain = new Precipitation(rawData.precipi, null, rawData.precipm);
        }
        if (rawData.snowfalli) {                      // todo: don't know if this value is in cm or mm; assuming mm for now for literally no good reason. Check again in winter or in a different location that currently has snow
            _snow = new Precipitation(rawData.snowfalli, null, rawData.snowfallm);
        }

        // hourly
        if (rawData.qpf && rawData.qpf.english) {
            _rain = new Precipitation(rawData.qpf.english, null, rawData.qpf.metric);
        }
        if (rawData.snow && rawData.snow.english) {
            _snow = new Precipitation(rawData.snow.english, null, rawData.snow.metric);
        }

        Object.defineProperties(this, {
            rain: {
                get: function() { return _rain; },
                enumerable: true
            },
            snow: {
                get: function() { return _snow; },
                enumerable: true
            }
        });
    }

    /**
     * metric getter is in cm
     * @param {String|Number} inches
     * @param {String|Number} cm
     * @param {String|Number} mm
     */
    function Precipitation(imperial, cm, mm) {
        var _imperial = parseFloat(imperial);
        var _metric = cm && parseFloat(cm) || mm && mmToCm(parseFloat(mm)) || inchToCm(_imperial);
        var _si = cmToM(_metric);
        if (_imperial < 0) { _imperial = 0; }
        if (_metric < 0) { _metric = 0; }
        if (_si < 0) { _si = 0; }

        Object.defineProperties(this, {
            imperial: {
                get: function() { return _imperial; },
                enumerable: true
            },
            metric: {
                get: function() { return _metric; },
                enumerable: true
            },
            si: {
                get: function() { return _si; },
                enumerable: true
            }
        });
    }

    return WeatherData;
});
