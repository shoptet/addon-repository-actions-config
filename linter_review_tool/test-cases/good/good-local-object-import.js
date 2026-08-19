// A local binding named Object is the partner's own module, not the built-in
// — must not trip the core-overwrite Object.assign detection (round 11).
import Object from './object-utils.js';

export function merge(target) {
  return Object.assign(target, { ready: true });
}
