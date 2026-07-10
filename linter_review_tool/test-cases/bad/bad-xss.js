function renderProduct(product) {
  const container = document.querySelector('.elevate-product');
  container.innerHTML = '<h2>' + product.name + '</h2>';
  container.insertAdjacentHTML('beforeend', `<p>${product.description}</p>`);
  document.write(product.code);
  $('.elevate-list').html(product.listHtml);
}
