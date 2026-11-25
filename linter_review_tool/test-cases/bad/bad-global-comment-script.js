// A classic script (the `with` statement fails the module parse): the
// /* global */ comment is only redundant and is not reported, but the
// top-level `var shoptet` really redeclares the Shoptet core global.
/* global shoptet */
var shoptet = {};
with (shoptet) {
  shoptet.ready = true;
}
