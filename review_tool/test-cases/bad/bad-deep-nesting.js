function deeplyNested(data) {
  if (data) {
    if (data.items) {
      if (data.items.length > 0) {
        if (data.items[0].price) {
          if (data.items[0].price > 100) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
