export function renderProduct(product) {
  const container = document.querySelector('.elevate-product');

  const title = document.createElement('h2');
  title.textContent = product.name;
  container.append(title);

  const link = document.createElement('a');
  link.href = '/product-detail';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'detail';
  container.append(link);
}

export function readPreference() {
  try {
    return localStorage.getItem('elevate_pref');
  } catch (error) {
    return null;
  }
}
