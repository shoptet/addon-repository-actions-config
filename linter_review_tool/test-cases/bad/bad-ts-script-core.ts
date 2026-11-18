// No import/export: this ships as a classic script, so its top-level function
// replaces the core global. The ambient declaration below emits no code and
// must not be reported; the unused handler may be wired from HTML (onclick)
// and must not be reported either.
declare const shoptet: { config: object };

function initColorBox(): void {}

function onCartClick(event: Event): void {
  event.preventDefault();
}
