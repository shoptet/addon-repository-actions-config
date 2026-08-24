// A second runtime-fact cluster (round 12): each is a deterministic guarantee.
export class Widget {}
Widget = null; // no-class-assign

export const settings = {
  get size() {}, // getter-return: no return
  set size(value) {
    return value; // no-setter-return
  },
};

export function pick(flag) {
  if (flag) {
    return 1;
  } else if (flag) { // no-dupe-else-if
    return 2;
  }
  settings.size = settings.size; // no-self-assign
  return 0;
}
