define([
    "underscore"
], function(
    _
) {
    function Alert(rawData) {
        var _date = null, _expiration = null, _description = null, _message, _phenomenon = null, _significance, _type = null, _ianaTimezone;

        _date = new Date(parseInt(rawData.date_epoch, 10) * 1000);
        _expiration = new Date(parseInt(rawData.expires_epoch, 10) * 1000);
        _description = rawData.description;
        _message = rawData.message;
        _phenomenon = rawData.phenomena;
        _significance = rawData.significance;
        _type = rawData.type;
        _ianaTimezone = rawData.tz_long;

        // later TBD:
        // rawData.StormBased == {}, unknown properties
        // rawData.ZONES == [], elements == {state: "MA", ZONE: "123"} state is a 2-letter state name, ZONE is a 3-digit
        //     string whose meaning is unknown


        Object.defineProperties(this, {
            date: {
                get: function() { return _date; },
                enumerable: true
            },
            expiration: {
                get: function() { return _expiration; },
                enumerable: true
            },
            description: {
                get: function() { return _description; },
                enumerable: true
            },
            message: {
                get: function() { return _message; },
                enumerable: true
            },
            // known values so far: "HT" (heat), "WS" (winter storm), "CF" (coastal flood)
            phenomenon: {
                get: function() { return _phenomenon; },
                enumerable: true
            },
            // known values so far: "Y", "W"
            significance: {
                get: function() { return _significance; },
                enumerable: true
            },
            // known values so far: "HEA" (heat), "WIN" (winter/wind?), "WAT" (water)
            type: {
                get: function() { return _type; },
                enumerable: true
            },
            ianaTimezone: {
                get: function() { return _ianaTimezone; },
                enumerable: true
            }
        });
    }

    return Alert;
});
