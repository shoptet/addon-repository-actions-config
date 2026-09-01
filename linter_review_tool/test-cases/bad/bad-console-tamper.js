// Tampering with the console slot itself (round 11).
export function silence() {
  window.console = { log() {} };
  delete window.console;
}
