// `declare const shoptet` describes the runtime global — it does not shadow it.
export {};

declare const shoptet: { x: number; config: object };

shoptet.x = 5;

export function init(): void {
  if (typeof shoptet === 'undefined') {
    return;
  }
}
