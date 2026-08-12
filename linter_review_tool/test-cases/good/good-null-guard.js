// `x == null` is the deliberate nullish guard (matches exactly null/undefined,
// no coercion surprises) — eqeqeq must not gate it.
export function orZero(x) {
  if (x == null) return 0;
  return x;
}
