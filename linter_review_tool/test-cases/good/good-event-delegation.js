document.addEventListener('click', (e) => {
  if (e.target.matches('.btn-add-to-cart')) {
    handleAddToCart(e);
  }
});

document.addEventListener('ShoptetDOMCartContentLoaded', () => {
  updateCartBadge();
});
