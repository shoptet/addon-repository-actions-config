// A /* global */ comment that names a global the file never reads is only
// redundant (CZ3TDR1-982): the comment is copied between files, the code has
// nothing to fix. Known and unknown names, multi-line, with a justification.
// A writable entry for a name the config does not declare is unused too; for a
// configured global it stays a no-redeclare opt-out (bad-global-writable.js).
/* global $, shoptet, myAddonRuntime */
/*global jQuery: readonly, dataLayer, myCounter: writable*/
/* globals
   Shoptet,
   legacyHelper: true -- kept from the old template */

export const ready = true;
