const ESHOP_ID = getShoptetDataLayer('projectId');

export async function loadProducts() {
  const response = await fetch('https://api.shoptet.cz/cache/products');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const config = {enabled: true, eshopId: ESHOP_ID};
