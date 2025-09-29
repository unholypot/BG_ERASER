const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// ===== DEV-ONLY BEGIN =====
const s3Service = process.env.NODE_ENV === 'development'
  ? require('../services/localStorage')
  : require('../services/s3');
// ===== DEV-ONLY END =====

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

// Upload and process image
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

    console.log(`Processing image: ${imageName}, Type: ${req.file.mimetype}, Size: ${req.file.buffer.length} bytes`);

    // Process the image to remove background
    const processedImage = await imageProcessorService.processImage(req.file.buffer, 'png', req.file.mimetype);

    // ===== DEV-ONLY BEGIN =====
    // Save files with cleaner names for dev
    const originalExt = req.file.mimetype.split('/')[1];
    const originalKey = `original_${userId}_${imageId}.${originalExt}`;
    const processedKey = `processed_${userId}_${imageId}.png`;
    // ===== DEV-ONLY END =====

    // Upload original
    await s3Service.uploadProcessedImage(originalKey, req.file.buffer, req.file.mimetype);

    // Upload processed
    const processedResult = await s3Service.uploadProcessedImage(processedKey, processedImage.buffer, 'image/png');

    // ===== DEV-ONLY BEGIN =====
    // Save to database with proper paths
    let dbImageId = imageId;
    if (process.env.NODE_ENV === 'development') {
      try {
        dbImageId = await databaseService.saveImageData(
          userId,
          imageName,
          `original/${originalKey}`,
          processedResult.key // This now contains the correct path
        );
      } catch (dbError) {
        console.log('DB save failed in dev, continuing:', dbError.message);
        dbImageId = imageId;
      }
    } else {
    // ===== DEV-ONLY END =====
      dbImageId = await databaseService.saveImageData(
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
    // ===== DEV-ONLY BEGIN =====
    }
    // ===== DEV-ONLY END =====

    res.json({
      error: false,
      message: 'Image processed successfully',
      imageId: dbImageId,
      processedUrl: processedResult.key, // Return the correct path
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

module.exports = router;