const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { client } = require('../src/config/dynamodb');

const tables = [
  {
    TableName: process.env.DYNAMODB_TABLE_NAME || 'Products',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.APPLICATIONS_TABLE_NAME || 'Applications',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.SUBMISSIONS_TABLE_NAME || 'Submissions',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'applicationId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      {
        IndexName: 'applicationId-index',
        KeySchema: [{ AttributeName: 'applicationId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
];

async function createTables() {
  for (const tableDef of tables) {
    try {
      await client.send(new CreateTableCommand(tableDef));
      console.log(`Table '${tableDef.TableName}' created successfully.`);
    } catch (err) {
      if (err.name === 'ResourceInUseException') {
        console.log(`Table '${tableDef.TableName}' already exists.`);
      } else {
        console.error(`Error creating table '${tableDef.TableName}':`, err);
        process.exit(1);
      }
    }
  }
}

createTables();
