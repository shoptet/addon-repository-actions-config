// A partner's own local variable named `shoptet` is not the Shoptet core —
// no mutation of it may trigger no-core-overwrite / no-global-assign.
export function makeState() {
  const shoptet = { cart: [], counter: 0 };
  shoptet.cart.push(1);
  shoptet.counter++;
  delete shoptet.cart;
  Object.assign(shoptet, { ready: true });
  return shoptet;
}
