// Everyday legacy callback idioms — short-circuit and ternary calls are
// intentional expressions, not dead code; they must not gate.
export function fire(cb, cond, onYes, onNo) {
  cb && cb();
  cond ? onYes() : onNo();
  return true;
}
