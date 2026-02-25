const {
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Products';

async function getAllProducts() {
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return result.Items || [];
}

async function getProductById(productId) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { productId } })
  );
  return result.Item || null;
}

async function createProduct(data) {
  const now = new Date().toISOString();
  const item = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(productId)',
    })
  );
  return item;
}

async function updateProduct(productId, data) {
  const existing = await getProductById(productId);
  if (!existing) {
    const err = new Error('Product not found');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  }

  const item = {
    ...existing,
    ...data,
    productId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

async function deleteProduct(productId) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { productId },
      ConditionExpression: 'attribute_exists(productId)',
    })
  );
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
