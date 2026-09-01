// A non-zero const delay and a reassignable let are left alone (round 12).
export function schedule(fn) {
  const DELAY = 250;
  setTimeout(fn, DELAY);
  let dynamic = 0;
  dynamic = 500;
  setTimeout(fn, dynamic);
}
