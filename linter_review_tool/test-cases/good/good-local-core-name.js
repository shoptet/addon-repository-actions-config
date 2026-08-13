// A partner's own local named like a core function (initColorBox is the
// standard Shoptet lightbox) cannot overwrite the global in module scope —
// neither a declared local nor a nested helper may trigger no-core-overwrite.
export function setup(mode) {
  let initColorBox;
  initColorBox = () => 'local';
  if (mode) initColorBox = () => 'alt';
  return initColorBox();
}

export function nested() {
  function initColorBox() { return 'nested'; }
  return initColorBox();
}
