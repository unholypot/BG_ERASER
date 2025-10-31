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
    throw error; // Re-throw to trigger retry mechanism
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
        VisibilityTimeout: 300,
        AttributeNames: ['ApproximateReceiveCount'] // Request receive count attribute
      }));
      
      if (result.Messages && result.Messages.length > 0) {
        for (const message of result.Messages) {
          const messageId = message.MessageId;
          const receiveCount = message.Attributes?.ApproximateReceiveCount || '1';
          
          logger.info(`Processing message ${messageId} (attempt #${receiveCount})`);
          
          try {
            // Process the message
            await processMessage(message);
            
            // ✅ SUCCESS: Delete message from queue
            await sqsClient.send(new DeleteMessageCommand({
              QueueUrl: process.env.SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle
            }));
            logger.info(`✅ Successfully processed and deleted message ${messageId}`);
            
          } catch (error) {
            // FAILURE: Log error 
            logger.error(`Error processing message ${messageId}:`);
            logger.error(` Error: ${error.message}`);
            logger.error(` Attempt: ${receiveCount}/3`);

            if (parseInt(receiveCount) >= 3) {
              logger.error(` This was the final attempt. Message will move to DLQ.`);
            } else {
              logger.error(` Message will be retried automatically.`);
            }
            
            
            // SQS will automatically make it visible again after visibility timeout
            // After 3 failed attempts, SQS will move it to the DLQ
          }
        }
      } else {
        logger.info(' No messages available');
      }
    } catch (error) {
      logger.error('Queue polling error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

pollQueue();