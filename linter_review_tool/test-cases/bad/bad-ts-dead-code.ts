// TypeScript counterparts of the JS dead-code / TDZ blockers.
const unusedLocal = 1;

export const early = later + 1;
const later = 2;

export function noop(value: number): void {
  value + 1;
}

// Only `_` is exempt: any other unused destructured name is still dead code.
export function firstOnly(parts: string[]): string {
  const [first, unusedSecond] = parts;
  return first;
}

// A real `var` on TypeScript is still reported (shoptet/no-var).
export var legacyTotal = 0;

// A class member's computed key IS evaluated: a real TDZ error (TS2448).
export abstract class Store {
  abstract [STORE_KEY]: string;
}
const STORE_KEY = 'key';

// tsc reports these `_` names, and so does the gate: a plain local and a
// shorthand destructured property.
const _plainLocal = 1;
export function pickId(record: { _id: number }): number {
  const { _id } = record;
  return 0;
}
