# WeatherDisplay

This is a JS/HTML app that I made for the purpose of having a live weather display on a mobile browser.

It uses the Weather Underground API to get data.

## Modes

Daily mode shows data for yesterday, today's forecast, tomorrow's forecast, and the next two days.

Hourly mode shows current conditions and hourly forecasts in the near future.

Data currently includes temperature (average, low, high, current, and/or current feels like, depending on what's available for the current view) and wind (speed and direction).

## Patch

In the lib directory is a monkey patched angular.js (v1.6.3). Changes are included that allow the framework to work on a Kindle Touch experimental browser. The reasoning for this is that I wanted to run the app on an e-ink tablet because it's low-energy and not backlit. See details of the patch at https://github.com/adashrod/angular.js/commit/3cfbf4f1a4348cf67bddba90bc9101fc460c4a57

## Running

- You'll need to sign up at https://www.wunderground.com/weather/api/ to get an API key.
- Create a copy of src/script/config/application.json.example, named application.json (in the same dir)
- put your API key in application.json

The other two config properties are only necessary if you want to be able to save runtime app preferences (weather location, units to display) between browser sessions while using a browser that clears local storage at the end of the session. This feature was built because - you guessed it - the Kindle Touch browser clears local storage and cookies at the end of every session.

If configured, the app will make a GET and a POST to {host} + {path} + /weatherPreferences. Content type is assumed to be text/plain.

Run a server and point your browser to {server}/.../WeatherDisplay.html
