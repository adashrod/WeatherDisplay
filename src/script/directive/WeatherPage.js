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
                }
            };

            $scope.$watch("data", function(newVal, oldVal) {
                $scope.now = new Date();
                _.each(newVal, function(wd) {
                    // rounding with a resolution of .5
                    wd.hoursFromNow = Math.round(2 * (wd.date.getTime() - $scope.now.getTime()) / (60 * 60 * 1000)) / 2;
                });
            });
            $scope.$watch("data.length", function(newVal, oldVal) {
                if ($scope.currentPage >= newVal) { $scope.currentPage = 0; }
            });

            $scope.previousPage = function() {
                if ($scope.currentPage > 0) { $scope.currentPage--; }
            };
            $scope.nextPage = function() {
                if ($scope.currentPage < $scope.data.length - 1) { $scope.currentPage++; }
            };
            $scope.hasPrevious = function() { return $scope.currentPage > 0; }
            $scope.hasNext = function() { return $scope.currentPage < $scope.data.length - 1; }

            $scope.onHomeClick = function() {
                $scope.currentPage = 0;
                $scope.goHome();
            };
        }
        WeatherPageController.$inject = ["$scope"];

        return {
            restrict: "E",
            scope: {
                data: "=",
                currentUnitSystems: "=",
                switchView: "=",
                goHome: "=",
                dateType: "="
            },
            templateUrl: "directive/WeatherPage.html",
            controller: WeatherPageController
        };
    }

    return WeatherPageDirective;
});
