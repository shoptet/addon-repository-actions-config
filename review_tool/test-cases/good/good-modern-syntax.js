const userId = dataLayer[0].shoptet.customer.guid;
const projectId = dataLayer[0].shoptet.projectId;

function processCart(items) {
  if (!items || items.length === 0) return;
  
  items.forEach(item => {
    const price = item.price;
    console.log(price);
  });
}

const config = {
  enabled: true,
  apiUrl: 'https://example.com'
};
