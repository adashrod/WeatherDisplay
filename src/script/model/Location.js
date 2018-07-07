define(function() {
    function Location(name, zipCode) {
        var _name = (name || "").toString(), _zipCode = (zipCode || "").toString();

        Object.defineProperties(this, {
            name: {
                get: function() { return _name; },
                enumerable: true
            },
            zipCode: {
                get: function() { return _zipCode; },
                enumerable: true
            }
        });
    }

    return Location;
});
