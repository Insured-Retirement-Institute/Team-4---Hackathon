const { PutCommand, GetCommand, QueryCommand, DeleteCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("./dynamo.js");

const DDB_TABLE_NAME="CarrierSubmissions";

const TABLE = process.env.DDB_TABLE_NAME || DDB_TABLE_NAME; // set this locally + in App Runner

async function saveSubmission(item) {
  // item must include your table's partition key (and sort key if you have one)
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: item,
  }));
}

async function getSubmission(submissionId) {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { submissionId }, // change to your real key name
  }));
  return res.Item;
}

async function deleteSubmission(submissionId) {
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { submissionId },
  }));
}

// Example query (if you have a sort key)
async function queryByPk(submissionId) {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": submissionId },
  }));
  return res.Items ?? [];
}

// List (scan) submissions with optional pagination
async function listSubmissions({ limit = 100, exclusiveStartKey } = {}) {
  const params = {
    TableName: TABLE,
    Limit: limit,
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }

  const res = await ddb.send(new ScanCommand(params));
  return {
    items: res.Items ?? [],
    lastEvaluatedKey: res.LastEvaluatedKey
  };
}

module.exports = { saveSubmission, getSubmission, deleteSubmission, queryByPk, listSubmissions };