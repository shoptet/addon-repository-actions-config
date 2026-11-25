// `writable` / `true` is not a redundant comment: it makes the global
// assignable and switches off no-global-assign / no-implicit-globals for it.
// Its no-redeclare report is what still blocks the overwrite.
/* global shoptet: writable, dataLayer: true */

export function reset() {
  shoptet = { ...shoptet, config: {} };
  dataLayer = dataLayer || [];
  return [shoptet, dataLayer];
}
