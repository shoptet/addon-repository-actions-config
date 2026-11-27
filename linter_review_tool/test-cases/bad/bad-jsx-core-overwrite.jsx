// A JSX file is module-local for top-level declarations (CZ3TDR1-986), but a
// WRITE to the core is not scope-dependent: it still blocks, also in a JSX
// file without import/export.
shoptet.cart = {};
window.initColorBox = () => <div />;
Object.assign(shoptet, { config: {} });
