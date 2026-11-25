// A /* global */ comment that repeats a global the config already declares
// is redundant, not an error (CZ3TDR1-979) — a common legacy habit to quiet a
// local no-undef.
/* global $, shoptet */
/*global jQuery, dataLayer*/
/* globals Shoptet */
/* global getShoptetDataLayer: readonly, screen: readable -- read-only is still redundant */
// A name the config does not know is a plain declaration, not a redeclaration.
/* global myAddonRuntime */

export function run() {
  return $('.x').length + jQuery('.y').length + shoptet.config.x + dataLayer.length + Shoptet.a + myAddonRuntime.v + getShoptetDataLayer() + screen.width;
}
