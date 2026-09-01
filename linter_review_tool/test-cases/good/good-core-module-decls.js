// A real module: its top-level bindings are module-local by the language —
// naming one after a core function is the partner's business (round 13).
export function use() {
  return initColorBox();
}
const initColorBox = () => 'mine';
