const {
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/dynamodb');

const TABLE_NAME = process.env.DISTRIBUTORS_TABLE_NAME || 'Distributors';

async function getAllDistributors() {
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return result.Items || [];
}

async function getDistributorById(distributorId) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { distributorId } })
  );
  return result.Item || null;
}

async function createDistributor(data) {
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
      ConditionExpression: 'attribute_not_exists(distributorId)',
    })
  );
  return item;
}

async function updateDistributor(distributorId, data) {
  const existing = await getDistributorById(distributorId);
  if (!existing) {
    const err = new Error('Distributor not found');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  }

  const item = {
    ...existing,
    ...data,
    distributorId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

async function deleteDistributor(distributorId) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { distributorId },
      ConditionExpression: 'attribute_exists(distributorId)',
    })
  );
}

module.exports = {
  getAllDistributors,
  getDistributorById,
  createDistributor,
  updateDistributor,
  deleteDistributor,
};
