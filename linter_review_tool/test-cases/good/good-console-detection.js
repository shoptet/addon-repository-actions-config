// Feature-detecting the console is a read, not output — must not be flagged
// by shoptet/no-global-console (parity with core no-console).
export function hasConsole() {
  return Boolean(window.console) && typeof globalThis.console !== 'undefined';
}
