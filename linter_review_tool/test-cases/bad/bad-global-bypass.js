// Blocker rules must not be evadable by writing through the global object or
// by respelling the zero delay.
window.shoptet.menu = function () {}; // shoptet/no-core-overwrite (via window)
window['setTimeout'](init, 0);        // shoptet/no-settimeout-hack (computed)
setTimeout(poll, '0');                // shoptet/no-settimeout-hack (string zero)
