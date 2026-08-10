// setTimeout(...args) forwards an unknown delay — must not be flagged as a
// zero-delay hack.
export function schedule(...args) {
  setTimeout(...args);
}
