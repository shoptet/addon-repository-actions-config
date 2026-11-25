// No import/export: a classic script. Its top-level functions may be called
// from HTML (onclick="…"), which ESLint cannot see — not "unused".
declare const shoptet: { config: object };

function onCartClick(event: Event): void {
  event.preventDefault();
}

function readConfig(): object {
  return shoptet.config;
}
