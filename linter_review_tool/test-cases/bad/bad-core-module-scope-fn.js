// No import/export → ships as a classic script → this top-level declaration
// leaks to the global scope and overwrites the core lightbox (round 12).
function initColorBox() {
  return 'hijacked';
}
window.addEventListener('load', initColorBox);
