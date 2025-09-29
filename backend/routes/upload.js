const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const s3Service = require('../services/s3');
const databaseService = require('../services/database');
const imageProcessorService = require('../services/imageProcessor');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'No image file provided'
      });
    }

    const userId = req.user.userId;
    const imageName = req.body.imageName || req.file.originalname.split('.')[0];
    const imageId = uuidv4();

    console.log(`Processing image: ${imageName}`);

    // Process the image to remove background
    const processedImage = await imageProcessorService.processImage(
      req.file.buffer, 
      'png', 
      req.file.mimetype
    );

    // Create S3 keys with user folder structure
    const originalExt = req.file.mimetype.split('/')[1];
    const originalKey = `${userId}/original/${imageId}.${originalExt}`;
    const processedKey = `${userId}/processed/${imageId}.png`;

    // Upload to S3
    await s3Service.uploadProcessedImage(originalKey, req.file.buffer, req.file.mimetype);
    await s3Service.uploadProcessedImage(processedKey, processedImage.buffer, 'image/png');

    // Get presigned URL for the processed image (for immediate display)
    const processedUrl = await s3Service.getSignedImageUrl(processedKey, 3600);

    // Save to database
    const dbImageId = await databaseService.saveImageData(
      userId,
      imageName,
      originalKey,
      processedKey
    );

    await databaseService.saveLog(
      userId,
      `Processed image: ${imageName}`,
      dbImageId
    );

    res.json({
      error: false,
      message: 'Image processed successfully',
      imageId: dbImageId,
      processedUrl: processedUrl, // Return presigned URL
      imageName: imageName
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to process image'
    });
  }
});

// New endpoint: Get presigned URL for direct upload (bonus feature)
router.post('/get-upload-url', authenticateToken, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const userId = req.user.userId;
    const imageId = uuidv4();
    
    const key = `${userId}/uploads/${imageId}-${filename}`;
    const uploadUrl = await s3Service.getSignedUploadUrl(key, contentType);
    
    res.json({
      uploadUrl,
      key,
      imageId
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: 'Failed to generate upload URL'
    });
  }
});

module.exports = router;