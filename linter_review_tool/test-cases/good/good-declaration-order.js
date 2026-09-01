// The "function above its config" pattern: the reference lives in a nested
// scope and runs after module init — no TDZ is possible, must not gate.
export function renderBadge() {
  return CONFIG.badge;
}
const CONFIG = { badge: 1 };
