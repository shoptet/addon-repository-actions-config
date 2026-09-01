export function run(code, el) {
  eval(code); // no-eval
  setTimeout('doWork()', 100); // no-implied-eval (string callback)
  el.href = 'javascript:void(0)'; // no-script-url
}
