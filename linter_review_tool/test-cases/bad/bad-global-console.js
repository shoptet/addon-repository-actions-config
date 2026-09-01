// Zero-console policy must not be bypassable through the global object.
window.console.log('a');
globalThis['console'].warn('b');
self.console.error('c');
