define(function() {
    /**
     * Truncates the decimal places on a number to maxPlaces, rounding the last digit. Similar to the angularjs number
     * filter, but without trailing zeroes
     * E.g.
     *     truncatedFloat(1.234, 2) === "1.23"
     *     truncatedFloat(1.567, 2) === "1.57"
     *     truncatedFloat(1.234, 5) === "1.234"
     *     truncatedFloat(1.234, 0) === "1"
     *     truncatedFloat(1.567, 0) === "2"
     * @param {String|Number} input     a number, or string representation of one, to modify
     * @param {Number}        maxPlaces default 0, max number of decimal places to display
     * @return {String} the number, as a string, possibly with some digits truncated
     */
    function truncatedFloat(input, maxPlaces) {
        if (input === null || typeof input === "undefined") { return input; }
        var mp = maxPlaces;
        if (typeof mp !== "number" || isNaN(mp) || mp < 0) { mp = 0; }
        var s = input.toString();
        var point = s.indexOf(".");
        if (point === -1) { return s; }
        if (point + mp + 1 >= s.length) { return s; }
        if (mp === 0) { return Math.round(parseFloat(input)).toString(); }
        var changeableDigit = parseInt(s[point + mp], 10);
        var determiner = parseInt(s[point + mp + 1], 10);
        if (determiner >= 5) {
            s = s.substring(0, point + mp) + (changeableDigit + 1);
        }
        return s.substring(0, point + mp + 1);
    }

    function factory() { return truncatedFloat; }
    return factory;
});
