define(function() {
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

            $scope.previousPage = function() {
                if ($scope.currentPage > 0) { $scope.currentPage--; }
            };
            $scope.nextPage = function() {
                if ($scope.currentPage < $scope.data.length - 1) { $scope.currentPage++; }
            };
            $scope.hasPrevious = function() { return $scope.currentPage > 0; }
            $scope.hasNext = function() { return $scope.currentPage < $scope.data.length - 1; }
        }
        WeatherPageController.$inject = ["$scope"];

        return {
            restrict: "E",
            scope: {
                data: "=",
                currentUnitSystems: "=",
                switchView: "="
            },
            templateUrl: "directive/WeatherPage.html",
            controller: WeatherPageController
        };
    }

    return WeatherPageDirective;
});
