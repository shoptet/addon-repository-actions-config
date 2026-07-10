const addButton = document.querySelector('[data-testid="add-to-cart"]');
const rows = document.querySelectorAll('[data-testid=cart-row]');

addButton.addEventListener('click', () => {
  rows.forEach(row => row.classList.add('elevate-active'));
});
