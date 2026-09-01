export function practices(name, snake_case_param) {
  var label = 'Hi ' + name; // prefer-template, no-var
  var label = 'a' + 'b'; // no-redeclare, no-useless-concat
  parseInt(name); // radix (+ no-unused-expressions? ne - call)
  label; // no-unused-expressions
  String.prototype.zap = function () {}; // no-extend-native
	 label = label.trim(); // no-mixed-spaces-and-tabs (tab + space indent)
  return label + snake_case_param; // camelcase na parametru
}
