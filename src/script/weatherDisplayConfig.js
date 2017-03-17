require.config({
    "baseUrl": "script",
    "paths": {
        "underscore": "lib/underscore-1.8.3",
        "text": "lib/requirejs-plugins/text",
        "json": "lib/requirejs-plugins/json"
    }
});

require(["weatherDisplayBoot"]);
