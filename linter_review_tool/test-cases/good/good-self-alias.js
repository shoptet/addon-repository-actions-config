// The classic jQuery-era `const self = this` alias: a LOCAL binding named
// self/window/globalThis is not the global object — none of the global-object
// rules (no-core-overwrite, no-global-console, no-settimeout-hack) may fire.
export function initWidget(config) {
  const self = this;
  self.shoptet = config.snapshot;
  self.shoptet.updated = 1;
  self.console.log = config.logger;
  self.setTimeout(config.cb, 0);
  return self;
}
