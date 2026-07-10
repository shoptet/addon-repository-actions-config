const userId = dataLayer[0].shoptet.customer.guid;
const projectId = dataLayer[0].shoptet.projectId;

function processCart(items) {
  if (!items || items.length === 0) return [];

  return items.map(item => item.price);
}

export const config = {
  userId,
  projectId,
  enabled: true,
  apiUrl: 'https://example.com',
  prices: processCart([]),
};
