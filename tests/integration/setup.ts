// Setup file for integration tests
// This file runs before each test file in the integration directory

process.env.IS_LOCAL = 'true';
process.env.TABLE_NAME = 'SnoreMDNotes-test';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.AWS_REGION = 'us-east-1';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
