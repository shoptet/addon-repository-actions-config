// The "function above its config" pattern: the reference lives in a nested
// scope and runs after module init — no TDZ is possible, must not gate.
export function renderBadge() {
  return CONFIG.badge;
}
const CONFIG = { badge: 1 };

// Same cut for classes: the error class is defined below the function that
// throws it, and the throw can only run after module init.
export function fail() {
  throw new AppError('failed');
}
class AppError extends Error {}

// A named export of a later declaration is a live binding — no TDZ.
export { doubled };
const doubled = (value) => value * 2;
