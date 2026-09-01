// The global-object spelling of a core-function write — the classic legacy
// way to define globals (round 12).
export function hack() {
  window.initColorBox = function () {};
  globalThis.initColorBox = () => {};
}
