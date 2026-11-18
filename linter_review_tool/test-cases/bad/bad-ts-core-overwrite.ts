// Type-only wrappers are erased at compile time — every line below is a real
// write into the Shoptet core at runtime (CZ3TDR1-938).
export {};

(window as any).shoptet = {};
(window as any).shoptet.config = 1;
(shoptet as any).x = 1;
shoptet!.y = 2;
(<any>window).shoptet.z = 3;
(window.shoptet as any).w = 4;
Object.assign(shoptet as any, {});
delete (shoptet as any).q;
(shoptet as any).counter++;
(shoptet.x as any) = 5;
