define(function() {
    function padWithZero(n) {
        var number = parseInt(n, 10);
        if (number < 10) { return "0" + number; }
        return number.toString();
    }

    function Phase(riseObj, setObj, percentIlluminated) {
        var _rise = padWithZero(riseObj.hour) + padWithZero(riseObj.minute),
            _set = padWithZero(setObj.hour) + padWithZero(setObj.minute),
            _percentIlluminated = parseInt(percentIlluminated, 10);

        Object.defineProperties(this, {
            rise: {
                get: function() { return _rise; },
                enumerable: true
            },
            set: {
                get: function() { return _set; },
                enumerable: true
            },
            percentIlluminated: {
                get: function() { return _percentIlluminated || null; },
                enumerable: true
            }
        });
    }

    function SunMoonPhase(sunPhaseData, moonPhaseData) {
        var _sunPhase = new Phase(sunPhaseData.sunrise, sunPhaseData.sunset),
            _moonPhase = new Phase(moonPhaseData.moonrise, moonPhaseData.moonset, moonPhaseData.percentIlluminated);

        Object.defineProperties(this, {
            sunPhase: {
                get: function() { return _sunPhase; },
                enumerable: true
            },
            moonPhase: {
                get: function() { return _moonPhase; },
                enumerable: true
            }
        });
    }

    return SunMoonPhase;
});
