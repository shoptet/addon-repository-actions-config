// The named zero — const with a literal init, resolved through scope (round 12).
export function defer(fn) {
  const DELAY = 0;
  setTimeout(fn, DELAY);
}
