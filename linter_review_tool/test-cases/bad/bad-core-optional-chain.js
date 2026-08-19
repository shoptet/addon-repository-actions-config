// Optional chaining must not bypass core-overwrite detection (round 11).
export function drop() {
  delete shoptet?.cart;
  Object.assign(shoptet?.config, { patched: true });
}
