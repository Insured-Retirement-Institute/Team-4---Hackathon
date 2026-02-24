const crypto = require('crypto');
const {
  GetCommand,
  PutCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/dynamodb');

const TABLE_NAME = process.env.SUBMISSIONS_TABLE_NAME || 'Submissions';

async function createSubmission({ applicationId, productId, payload, rawAnswers, confirmationNumber, metadata }) {
  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    applicationId,
    productId,
    payload,
    rawAnswers,
    confirmationNumber,
    status: 'received',
    metadata: metadata || {},
    submittedAt: now,
    createdAt: now,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

async function getSubmissionById(id) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { id } })
  );
  return result.Item || null;
}

async function getSubmissionsByApplicationId(applicationId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'applicationId-index',
      KeyConditionExpression: '#appId = :appId',
      ExpressionAttributeNames: { '#appId': 'applicationId' },
      ExpressionAttributeValues: { ':appId': applicationId },
    })
  );
  return result.Items || [];
}

module.exports = {
  createSubmission,
  getSubmissionById,
  getSubmissionsByApplicationId,
};
