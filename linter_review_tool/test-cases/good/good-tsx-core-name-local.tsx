// The same for TSX: always built, so the top-level function stays local
// (CZ3TDR1-986).
function initColorBox(): JSX.Element {
  return <div className="addon-colorbox" />;
}

initColorBox();
