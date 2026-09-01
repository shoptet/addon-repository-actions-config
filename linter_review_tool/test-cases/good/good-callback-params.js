// Callback signatures are dictated by the API — an unused `event` param is not
// dead code (args: 'none'), even in a real module.
export function bindClose(el) {
  el.addEventListener('click', function (event) {
    el.classList.remove('open');
  });
}
