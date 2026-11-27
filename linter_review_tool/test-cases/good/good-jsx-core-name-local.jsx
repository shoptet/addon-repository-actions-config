// A JSX file does not run without a build, and the bundler wraps it in its
// own module scope: a top-level function named like a Shoptet core function
// is module-local, also without any import/export (CZ3TDR1-986).
function initColorBox() {
  return <div className="addon-colorbox" />;
}

initColorBox();
