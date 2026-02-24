const fs = require('fs');
const path = require('path');

const products = {};

function loadProducts() {
  const assetsDir = path.resolve(__dirname, '../../Assets');
  if (!fs.existsSync(assetsDir)) return;

  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(assetsDir, file), 'utf-8'));
      if (data.productId) {
        products[data.productId] = data;
      }
    } catch (err) {
      console.error(`Failed to load product file ${file}:`, err.message);
    }
  }
  console.log(`Loaded ${Object.keys(products).length} product definition(s)`);
}

function getProduct(productId) {
  return products[productId] || null;
}

// Load on module initialization
loadProducts();

module.exports = { getProduct, loadProducts };
