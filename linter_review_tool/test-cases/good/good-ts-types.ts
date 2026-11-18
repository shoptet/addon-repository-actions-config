// TypeScript syntax that the JS core rules misread — none of it is a finding.
import type { Settings } from './settings';
import { type Product, formatPrice } from './product';

export interface CartLine {
  product: Product;
  settings: Settings;
}

export type LineId = string;

// Overloads are not redeclarations.
export function toCents(value: string): number;
export function toCents(value: number): number;
export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

// Enum members and namespace/function merging.
export enum Mode {
  Compact = 'compact',
  Full = 'full',
}
export function widget(): string {
  return Mode.Full;
}
export namespace widget {
  export const version = 1;
}

// A type used before its declaration cannot throw.
export function describe(line: Later): string {
  return line.label;
}
interface Later {
  label: string;
}

// Ambient declarations: the runtime already has these (names it dictates).
declare const shoptet: { config: { currency_code: string } };
declare global {
  var addon_state: number;
  interface Window {
    myAddon: unknown;
  }
}

export class Line {
  constructor(
    private readonly amount: number,
    public label: string,
  ) {}

  get total(): number {
    return this.amount;
  }
}

export abstract class Renderer {
  abstract render(): void;
}

export const identity = <T>(value: T): T => value;

export function isText(value: unknown): value is string {
  return typeof value === 'string';
}

export type Selector = '[data-testid="cart"]';

export const currency = shoptet.config.currency_code;
export const price = formatPrice(1);
export const state = window.addon_state;

// A value and a type of the same name live in different namespaces — the
// everyday "enum object" idiom, not a redeclaration.
export const ColorMode = { Eshop: 'eshop', Custom: 'custom' } as const;
export type ColorMode = (typeof ColorMode)[keyof typeof ColorMode];

// Values used only in type positions — the compiler counts these as used.
declare const brand: unique symbol;
export type Branded = string & { [brand]: true };
const HOSTS = { 'api.example.com': 'reason' };
export type Host = keyof typeof HOSTS;

// A class used from a nested scope before its declaration line.
export function fail(): never {
  throw new AppError('failed');
}
class AppError extends Error {}
