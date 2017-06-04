define([
    "underscore"
], function(
    _
) {
    /**
     * WeatherPage is a display for various kinds of weather data found in WeatherData objects.
     * @attr data                 an array of WeatherData objects, each one will be placed into a page, with buttons
     *                            for switching between the pages
     * @attr current-unit-systems an array of strings representing which unit systems should currently be displayed
     * @attr switch-view          a reference to a callback function, invoked when the switch button is pressed. Receives
     *                            no arguments
     */
    function WeatherPageDirective() {
        function WeatherPageController($scope) {
            $scope.currentPage = 0;
            $scope.supplementalPage = 0;
            // todo: maybe create another directive for the supplemental pages
            var numSuppPages = 2;
            $scope.unitNamesBySystem = {
                temperature: {
                    imperial: "°F",
                    metric: "°C",
                    si: "K"
                },
                speed: {
                    imperial: "mph",
                    metric: "kph",
                    si: "m/s"
                },
                length: {
                    imperial: "in",
                    metric: "cm",
                    si: "m"
                }
            };

            $scope.$watch("data", function(newVal, oldVal) {
                getMidnightEpoch.cache = {};
                $scope.getDayDifference.cache = {};
                $scope.now = new Date();
                _.each(newVal, function(wd) {
                    // rounding with a resolution of .5
                    wd.hoursFromNow = Math.round(2 * (wd.date.getTime() - $scope.now.getTime()) / (60 * 60 * 1000)) / 2;
                });
            });
            $scope.$watch("data.length", function(newVal, oldVal) {
                if ($scope.currentPage >= newVal) { $scope.currentPage = 0; }
            });

            /**
             * For a given date, returns the epoch (in ms) of midnight of that day, e.g. (pseudocode)
             * gME(Jan 4th 1pm) == Jan 4th 12am
             * gME(Jan 4th 5pm) == Jan 4th 12am
             * gME(Jan 4th 3am) == Jan 4th 12am
             * @param {Date} date
             * @return {Number} epoch, in ms, of midnight that day
             */
            function getMidnightEpoch(date) {
                if (date.getTime() in getMidnightEpoch.cache) { return getMidnightEpoch.cache[date.getTime()]; }
                var e = date.getTime() - (date.getMilliseconds() +
                    1000 * date.getSeconds() +
                    60 * 1000 * date.getMinutes() +
                    60 * 60 * 1000 * date.getHours());
                getMidnightEpoch.cache[date.getTime()] = e;
                return e;
            }
            getMidnightEpoch.cache = {};

            /**
             * Given two dates, calculates the difference between them in days, regardless of what point in the days
             * they are, e.g. (pseudocode)
             * gDD(Jan 4th 12pm, Jan 6th 12pm) == 2
             * gDD(Jan 4th 11pm, Jan 6th 1am) == 2
             * gDD(Jan 4th 12pm, Jan 4th 5am) == 0
             * gDD(Jan 5th 12pm, Jan 4th 12pm) == -1
             * @param {Date} a
             * @param {Date} b
             * @return {Number} difference, in days, of b - a
             */
            $scope.getDayDifference = function(a, b) {
                var key = a.getTime().toString() + "_" + b.getTime().toString();
                if (key in $scope.getDayDifference.cache) { return $scope.getDayDifference.cache[key]; }
                var aE = getMidnightEpoch(a), bE = getMidnightEpoch(b);
                var msDiff = bE - aE;
                var dayDiff = msDiff / (24 * 60 * 60 * 1000);
                $scope.getDayDifference.cache[key] = dayDiff;
                return dayDiff;
            };
            $scope.getDayDifference.cache = {};

            $scope.nextSupplementalPage = function() {
                $scope.supplementalPage++;
                $scope.supplementalPage %= numSuppPages;
            };

            if ($scope.api) {
                $scope.api.previousPage = function() {
                    if ($scope.currentPage > 0) { $scope.currentPage--; }
                };
                $scope.api.nextPage = function() {
                    if ($scope.currentPage < $scope.data.length - 1) { $scope.currentPage++; }
                };
                $scope.api.hasPrevious = function() { return $scope.currentPage > 0; };
                $scope.api.hasNext = function() { return $scope.currentPage < $scope.data.length - 1; };
                $scope.api.goToPage = function(page) {
                    if (page >= 0 && page < $scope.data.length) { $scope.currentPage = page; }
                };
            }

        }
        WeatherPageController.$inject = ["$scope"];

        return {
            restrict: "E",
            scope: {
                data: "=",
                currentUnitSystems: "=",
                api: "=",
                dateType: "="
            },
            templateUrl: "directive/WeatherPage.html",
            controller: WeatherPageController
        };
    }

    return WeatherPageDirective;
});
