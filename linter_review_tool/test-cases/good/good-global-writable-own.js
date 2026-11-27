// A file that declares its own writable global (a name the config does not
// declare) and writes it is not a defect: the write is reported only when the
// entry is read-only (CZ3TDR1-982, Roman on #29).
/* global myFlag: writable */

export function enable() {
  myFlag = true;
}
