// A template-literal zero coerces exactly like the string form (round 11).
export function defer(fn) {
  setTimeout(fn, `0`);
}
