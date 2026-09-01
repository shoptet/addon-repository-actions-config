const addButton = document.querySelector('[data-testid="add-to-cart"]');
const rows = document.querySelectorAll('[data-testid=cart-row]');

addButton.addEventListener('click', () => {
  rows.forEach(row => row.classList.add('elevate-active'));
});

// Round 13: the testid on the THIRD line of the template must anchor there,
// not on the literal's first line (line asserted in the selftest).
export const widgetMarkup = `
  <style>
    .promo [data-testid="price"] { color: red; }
  </style>
`;
