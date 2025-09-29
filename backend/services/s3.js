const { s3Client } = require('../config/aws');
const { GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class S3Service {
  async uploadProcessedImage(key, buffer, contentType) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType
    };

    try {
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
      return { success: true, key };
    } catch (error) {
      throw new Error('Failed to upload to S3: ' + error.message);
    }
  }

  async getSignedImageUrl(key) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    };

    try {
      const command = new GetObjectCommand(params);
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return url;
    } catch (error) {
      throw new Error('Failed to get signed URL: ' + error.message);
    }
  }

  async listUserImages(userId) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Prefix: `${userId}/`
    };

    try {
      const command = new ListObjectsV2Command(params);
      const result = await s3Client.send(command);
      return result.Contents || [];
    } catch (error) {
      throw new Error('Failed to list images: ' + error.message);
    }
  }

  async getImageStream(key) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    };

    try {
      const command = new GetObjectCommand(params);
      const response = await s3Client.send(command);
      return response.Body;
    } catch (error) {
      throw new Error('Failed to get image: ' + error.message);
    }
  }
}

module.exports = new S3Service();