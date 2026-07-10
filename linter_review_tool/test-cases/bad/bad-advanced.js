function render(product, el) {
  setTimeout(el.init, 50);
  const img = document.createElement('img');
  img.src = product.image;
  el.style.cssText = product.styles;
  fetch('/cache/x').then((r) => r.json());
  window.myGlobalState = product;
  localStorage.setItem('recentlyViewed', '1');
  const label = 'Není skladem';
  const price = product.price.toLocaleString('cs-CZ');
  el.innerHTML = `<div onclick="openModal()">x</div><img src="a.jpg">`;
  return label + price;
}

render(window.product, document.body);
