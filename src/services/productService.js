const crypto = require('crypto');
const {
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Products';

async function getAllProducts() {
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return result.Items || [];
}

async function getProductById(id) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { id } })
  );
  return result.Item || null;
}

async function createProduct(data) {
  const item = {
    id: crypto.randomUUID(),
    carrier: data.carrier,
    productName: data.productName,
    productId: data.productId,
    effectiveDate: data.effectiveDate,
    description: data.description,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

async function updateProduct(id, data) {
  const fields = ['carrier', 'productName', 'productId', 'effectiveDate', 'description'];
  const expressionParts = [];
  const expressionValues = {};
  const expressionNames = {};

  for (const field of fields) {
    if (data[field] !== undefined) {
      expressionParts.push(`#${field} = :${field}`);
      expressionValues[`:${field}`] = data[field];
      expressionNames[`#${field}`] = field;
    }
  }

  if (expressionParts.length === 0) {
    return getProductById(id);
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionValues,
      ExpressionAttributeNames: expressionNames,
      ConditionExpression: 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

async function deleteProduct(id) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
      ConditionExpression: 'attribute_exists(id)',
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
