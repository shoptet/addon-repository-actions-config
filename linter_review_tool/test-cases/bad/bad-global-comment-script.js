// A classic script (the `with` statement fails the module parse): the
// /* global */ comment is only redundant and is not reported, but the
// top-level `var shoptet` really redeclares the Shoptet core global.
/* global shoptet */
var shoptet = {};
with (shoptet) {
  shoptet.ready = true;
}

// Comment-like text must not hide a redeclaration in code: `/* global`
// inside a line comment (closed only by the JSDoc below) …
// TODO: add /* global helper
var jQuery = {};
/** docs */
// … and an identifier glued to the closing delimiter is code, not comment.
var /* global Shoptet */Shoptet = {};
