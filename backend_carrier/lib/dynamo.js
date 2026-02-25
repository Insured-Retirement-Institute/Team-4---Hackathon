const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const AWS_REGION="us-east-1";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || AWS_REGION;

const client = new DynamoDBClient({ region: REGION });

// DocumentClient gives you native JS objects (recommended)
const ddb = DynamoDBDocumentClient.from(client);

module.exports = { ddb };