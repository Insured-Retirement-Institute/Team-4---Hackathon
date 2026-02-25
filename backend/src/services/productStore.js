const fs = require('fs');
const path = require('path');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Products';

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

async function getProduct(productId) {
  if (products[productId]) {
    return products[productId];
  }

  // Fallback: query DynamoDB by productId
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'productId = :pid',
        ExpressionAttributeValues: { ':pid': productId },
      })
    );

    if (result.Items && result.Items.length > 0) {
      const product = result.Items[0];
      products[productId] = product;
      return product;
    }
  } catch (err) {
    console.error(`Failed to fetch product ${productId} from DynamoDB:`, err.message);
  }

  return null;
}

function addProduct(product) {
  if (product && product.productId) {
    products[product.productId] = product;
  }
}

// Load on module initialization
loadProducts();

module.exports = { getProduct, loadProducts, addProduct };
