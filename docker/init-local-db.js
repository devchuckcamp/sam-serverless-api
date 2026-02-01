#!/usr/bin/env node
/**
 * Initialize local DynamoDB table and import data for development
 * Uses the same DynamoDB client pattern as src/data/client.ts
 */

const { DynamoDBClient, CreateTableCommand, ListTablesCommand, BatchWriteItemCommand } = require('@aws-sdk/client-dynamodb');
const fs = require('fs');
const path = require('path');

const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const TABLE_NAME = process.env.TABLE_NAME || 'SnoreMDNotes-dev';
const REGION = process.env.AWS_REGION || 'us-east-1';
const EXPORT_FILE = path.join(__dirname, '..', 'dynamodb-export.json');

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

async function waitForDynamoDB(maxRetries = 10, delayMs = 1000) {
  console.log('Waiting for DynamoDB Local to be ready...');

  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log('DynamoDB Local is ready!');
      return true;
    } catch (error) {
      if (i < maxRetries - 1) {
        process.stdout.write(`\rRetrying... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.log('\nFailed to connect to DynamoDB Local');
  return false;
}

async function createTable() {
  console.log(`Creating DynamoDB table: ${TABLE_NAME}`);
  console.log(`Endpoint: ${ENDPOINT}`);

  try {
    const command = new CreateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });

    await client.send(command);
    console.log(`Table ${TABLE_NAME} created successfully!`);
    return true;
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`Table ${TABLE_NAME} already exists.`);
      return false;
    } else {
      console.error('Error creating table:', error.message);
      process.exit(1);
    }
  }
}

async function importData() {
  if (!fs.existsSync(EXPORT_FILE)) {
    console.log(`\nNo export file found at: ${EXPORT_FILE}`);
    console.log('Skipping data import.');
    return;
  }

  console.log(`\nImporting data from: ${EXPORT_FILE}`);

  const data = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
  const items = data.Items || [];

  if (items.length === 0) {
    console.log('No items to import.');
    return;
  }

  console.log(`Found ${items.length} items to import...`);

  // BatchWriteItem can only handle 25 items at a time
  const BATCH_SIZE = 25;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const putRequests = batch.map(item => ({
      PutRequest: { Item: item }
    }));

    try {
      const command = new BatchWriteItemCommand({
        RequestItems: {
          [TABLE_NAME]: putRequests
        }
      });

      const response = await client.send(command);

      // Handle unprocessed items
      const unprocessed = response.UnprocessedItems?.[TABLE_NAME]?.length || 0;
      imported += batch.length - unprocessed;
      failed += unprocessed;

      // Progress indicator
      const progress = Math.round(((i + batch.length) / items.length) * 100);
      process.stdout.write(`\rProgress: ${progress}% (${imported} imported)`);
    } catch (error) {
      console.error(`\nBatch error: ${error.message}`);
      failed += batch.length;
    }
  }

  console.log(`\n\nImport complete: ${imported} items imported, ${failed} failed.`);
}

async function listTables() {
  console.log('\nExisting tables:');
  try {
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    if (response.TableNames.length === 0) {
      console.log('  (no tables)');
    } else {
      response.TableNames.forEach(name => console.log(`  - ${name}`));
    }
  } catch (error) {
    console.error('Error listing tables:', error.message);
  }
}

async function main() {
  // Wait for DynamoDB Local to be ready
  const ready = await waitForDynamoDB();
  if (!ready) {
    console.error('Could not connect to DynamoDB Local. Is the container running?');
    process.exit(1);
  }

  const isNewTable = await createTable();

  // Only import data if table was just created
  if (isNewTable) {
    await importData();
  } else {
    console.log('\nTable already exists - skipping data import.');
    console.log('To reimport, stop docker and run: npm run dev:docker:stop && npm run dev:docker && npm run dev:docker:init');
  }

  await listTables();
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
