// Every way of mutating the Shoptet core must gate, not just plain assignment.
delete shoptet.helpers;             // shoptet/no-core-overwrite
Object.assign(shoptet, { a: 1 });   // shoptet/no-core-overwrite
Shoptet.custom = 1;                 // shoptet/no-core-overwrite (capital-S core global)
shoptet.counter++;                  // shoptet/no-core-overwrite
for (shoptet.current of [1]) { /* noop */ }  // shoptet/no-core-overwrite
shoptet = {};                       // no-global-assign (whole-object replacement)
