const ESHOP_ID = getShoptetDataLayer('projectId');

fetch('https://api.shoptet.cz/cache/products')
  .then(r => r.json())
  .then(data => console.log(data));

const config = {enabled: true};
