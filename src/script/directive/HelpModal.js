define([
    "underscore"
], function(
    _
) {
    /**
     * Creates a clickable "[?]" button, which displays a modal when clicked. Clicking the button again closes the modal.
     * Usage: <help-modal>This is some help text</help-modal>
     */
    function HelpModalDirective() {
        function HelpModalController($scope) {
            $scope.visible = false;

            $scope.toggle = function() { $scope.visible = !$scope.visible; };
        }
        HelpModalController.$inject = ["$scope"];

        return {
            restrict: "E",
            transclude: true,
            scope: {},
            template: "<span style=\"position:relative\"><span title=\"help\" class=\"help-toggle\" ng-click=\"toggle()\">[?]</span><div ng-transclude=\"ng-transclude\" ng-show=\"visible\" class=\"help-modal\"></div></span>",
            controller: HelpModalController
        };
    }

    return HelpModalDirective;
});
