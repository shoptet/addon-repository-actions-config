// Načteme produkty z košíku a spočítáme cenu
function calculateTotal(items) {
  /* Projdeme všechny položky a sečteme je dohromady */
  return items.reduce((sum, item) => sum + item.price, 0);
}

/* This block comment starts in English.
   The second line is still English.
   Třetí řádek už je česky — anchor here. */
