// A partner's own local variable named `shoptet` is not the Shoptet core and
// must not trigger no-core-overwrite.
export function makeState() {
  const shoptet = { cart: [] };
  shoptet.cart.push(1);
  return shoptet;
}
