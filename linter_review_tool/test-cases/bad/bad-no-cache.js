fetch('https://api.shoptet.cz/api/products')
  .then(response => response.json())
  .then(data => console.log(data));

$.post('https://api.myshoptet.com/data', {id: 123});
