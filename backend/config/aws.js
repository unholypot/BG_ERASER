const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { S3Client } = require('@aws-sdk/client-s3');

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION
});

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

module.exports = {
  cognitoClient,
  s3Client
};