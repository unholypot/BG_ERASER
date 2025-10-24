require('dotenv').config();
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const winston = require('winston');
const s3Service = require('./services/s3');
const databaseService = require('./services/database');
const imageProcessorService = require('./services/imageProcessor');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
});

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

async function processMessage(message) {
  const data = JSON.parse(message.Body);
  logger.info(`Processing image ${data.imageId}`);
  
  try {
    const imageStream = await s3Service.getImageStream(data.originalKey);
    const chunks = [];
    for await (const chunk of imageStream) {
      chunks.push(chunk);
    }
    const inputBuffer = Buffer.concat(chunks);
    
    const processedImage = await imageProcessorService.processImage(
      inputBuffer,
      'png',
      data.mimeType
    );
    
    await s3Service.uploadProcessedImage(
      data.processedKey,
      processedImage.buffer,
      'image/png'
    );
    
    await databaseService.updateImageStatus(data.imageId, 'completed');
    await databaseService.saveLog(
      data.userId,
      `Image processing completed: ${data.imageName}`,
      data.imageId
    );
    
    logger.info(`Successfully processed image ${data.imageId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to process image ${data.imageId}:`, error);
    await databaseService.updateImageStatus(data.imageId, 'failed');
    return false;
  }
}

async function pollQueue() {
  logger.info('Processor service started');
  
  // Initialize database tables on startup
  try {
    logger.info('Initializing database tables...');
    await databaseService.createTables();
    logger.info('Database tables verified/created successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
  
  while (true) {
    try {
      const result = await sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 300
      }));
      
      if (result.Messages && result.Messages.length > 0) {
        for (const message of result.Messages) {
          const success = await processMessage(message);
          if (success) {
            await sqsClient.send(new DeleteMessageCommand({
              QueueUrl: process.env.SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle
            }));
          }
        }
      }
    } catch (error) {
      logger.error('Queue polling error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

pollQueue();