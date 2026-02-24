const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { client } = require('../src/config/dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Products';

async function createTable() {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      })
    );
    console.log(`Table '${TABLE_NAME}' created successfully.`);
  } catch (err) {
    if (err.name === 'ResourceInUseException') {
      console.log(`Table '${TABLE_NAME}' already exists.`);
    } else {
      console.error('Error creating table:', err);
      process.exit(1);
    }
  }
}

createTable();
