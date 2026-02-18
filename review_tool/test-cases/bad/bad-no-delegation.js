document.querySelectorAll('.btn').forEach(el => {
  el.addEventListener('click', handleClick);
});

const submitBtn = document.querySelector('#submit-order');
submitBtn.addEventListener('click', function(e) {
  e.preventDefault();
});
