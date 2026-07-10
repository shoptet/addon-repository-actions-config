// Načteme produkty z košíku a spočítáme cenu
function calculateTotal(items) {
  /* Projdeme všechny položky a sečteme je dohromady */
  return items.reduce((sum, item) => sum + item.price, 0);
}
