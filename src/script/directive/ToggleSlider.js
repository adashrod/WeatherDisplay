define(function() {

    /**
     * A directive for a UI element that is functionally a checkbox (button with two states). Visually it is a sliding
     * button that slides to the left or right (left is on/true, right is off/false).  Assign something from the parent
     * scope with the attribute "boolean-property" for updates when the button is pressed. Choose what label to display
     * for when the button is "on" or "off" with the attributes "true-value" and "false-value"
     * @attr boolean-property reference to a boolean property on the parent scope whose value will be changed when the
     *                        button is pressed
     * @attr true-value       text to display when the button's value is true
     * @attr false-value      text to display when the button's value is false
     */
    function ToggleSliderDirective() {
        function ToggleSliderController($scope) {
            this.toggle = function() { $scope.booleanProperty = !$scope.booleanProperty; };
        }
        ToggleSliderController.$inject = ["$scope"];

        return {
            restrict: "E",
            scope: {
                booleanProperty: "=",
                trueValue: "@",
                falseValue: "@"
            },
            templateUrl: "directive/ToggleSlider.html",
            controller: ToggleSliderController,
            controllerAs: "ctrl"
        };
    }

    return ToggleSliderDirective;
});
