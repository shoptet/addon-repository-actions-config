// The built-in reached through the global object counts too (round 11).
export function patch() {
  window.Object.assign(shoptet, { hacked: true });
}
