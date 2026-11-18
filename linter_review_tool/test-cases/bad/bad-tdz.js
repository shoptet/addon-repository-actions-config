export function run() {
  const firstId = box.id;
  const box = document.querySelector('.elevate-x');
  return firstId;
}

// Same scope, before the class line — a ReferenceError at load time.
export const widget = new Widget();
class Widget {}
