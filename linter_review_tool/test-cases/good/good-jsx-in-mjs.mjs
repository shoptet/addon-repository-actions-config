// An `.mjs` file is a module by its extension, also with JSX and without any
// import/export: a top-level function is module-local, not a redefinition of
// the Shoptet core function of the same name (CZ3TDR1-968, Copilot on #30).
function initColorBox() {
  return <div className="addon-colorbox" />;
}

initColorBox();
