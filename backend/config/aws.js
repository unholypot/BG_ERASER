const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { S3Client } = require('@aws-sdk/client-s3');

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION
});

// Remove the explicit credentials - let SDK use default credential chain
const s3Client = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION
  // Remove the credentials block entirely - SDK will use SSO
});

module.exports = {
  cognitoClient,
  s3Client
};