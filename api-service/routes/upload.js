const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const s3Service = require('../services/s3');
const databaseService = require('../services/database');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const upload = multer({ storage: multer.memoryStorage() });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No image provided' });
    }

    const userId = req.user.userId;
    const imageName = req.body.imageName || req.file.originalname.split('.')[0];
    const imageId = uuidv4();

    // Upload original image to S3
    const originalExt = req.file.mimetype.split('/')[1];
    const originalKey = `${userId}/original/${imageId}.${originalExt}`;
    const processedKey = `${userId}/processed/${imageId}.png`;
    
    await s3Service.uploadProcessedImage(originalKey, req.file.buffer, req.file.mimetype);

    // Save initial record to database with 'processing' status
    const dbImageId = await databaseService.saveImageData(
      userId,
      imageName,
      originalKey,
      processedKey,
      'processing'  // Add status field
    );

    // Send message to SQS for processing
    const message = {
      imageId: dbImageId,
      userId,
      imageName,
      originalKey,
      processedKey,
      mimeType: req.file.mimetype
    };

    await sqsClient.send(new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(message)
    }));

    await databaseService.saveLog(userId, `Image queued for processing: ${imageName}`, dbImageId);

    res.json({
      error: false,
      message: 'Image queued for processing',
      imageId: dbImageId,
      status: 'processing'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

module.exports = router;