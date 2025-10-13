const { S3Client } = require('@aws-sdk/client-s3');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

const s3Client = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION
});

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION
});

module.exports = { s3Client, cognitoClient };