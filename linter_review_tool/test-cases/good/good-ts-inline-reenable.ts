/* eslint no-unused-vars: "error", no-redeclare: "error" */
// Switching a replaced core rule back on must not let it misread TypeScript:
// core no-unused-vars would report the enum member and the interface below,
// core no-redeclare the overloads.
export enum Mode {
  Compact = 'compact',
}

declare global {
  interface Window {
    myAddon: unknown;
  }
}

export function pick(value: string): string;
export function pick(value: number): number;
export function pick(value: string | number): string | number {
  return value;
}
