const crypto = require('crypto');
const {
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/dynamodb');

const TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME || 'Applications';

async function createApplication(productId) {
  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    productId,
    answers: {},
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

async function getApplicationById(id) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { id } })
  );
  return result.Item || null;
}

async function updateApplicationAnswers(id, answers) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: 'SET #answers = :answers, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#answers': 'answers',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':answers': answers,
        ':updatedAt': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes;
}

async function updateApplicationStatus(id, status) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes;
}

async function updateApplicationCarrierData(id, carrierData) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression:
        'SET #submissionId = :sid, #policyNumber = :pn, #status = :status, #updatedAt = :now',
      ExpressionAttributeNames: {
        '#submissionId': 'submissionId',
        '#policyNumber': 'policyNumber',
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':sid': carrierData.submissionId,
        ':pn': carrierData.policyNumber,
        ':status': 'carrier_accepted',
        ':now': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes;
}

async function getAllApplications() {
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return result.Items || [];
}

module.exports = {
  getAllApplications,
  createApplication,
  getApplicationById,
  updateApplicationAnswers,
  updateApplicationStatus,
  updateApplicationCarrierData,
};
