const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// ===== DEV-ONLY BEGIN =====
const s3Service = process.env.NODE_ENV === 'development'
  ? require('../services/localStorage')
  : require('../services/s3');
// ===== DEV-ONLY END =====
// Production: const s3Service = require('../services/s3');

const databaseService = require('../services/database');
const imageProcessorService = require('../services/imageProcessor');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

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
    const imageName = req.body.imageName || req.file.originalname;
    const imageId = uuidv4();

    // ===== DEV-ONLY BEGIN =====
    console.log(`Processing image: ${imageName}, Type: ${req.file.mimetype}, Size: ${req.file.buffer.length} bytes`);
    // ===== DEV-ONLY END =====

    // Process the image to remove background
    const processedImage = await imageProcessorService.processImage(req.file.buffer, 'png', req.file.mimetype);

    // Upload original to S3
    const originalKey = `${userId}/original_${imageId}.${req.file.mimetype.split('/')[1]}`;
    await s3Service.uploadProcessedImage(originalKey, req.file.buffer, req.file.mimetype);

    // Upload processed to S3
    const processedKey = `${userId}/processed_${imageId}.png`;
    await s3Service.uploadProcessedImage(processedKey, processedImage.buffer, 'image/png');

    // ===== DEV-ONLY BEGIN =====
    let dbImageId = imageId;
    if (process.env.NODE_ENV === 'development') {
      console.log('Dev mode: Skipping full database save, using mock ID');
      // Create minimal DB entry for dev
      try {
        dbImageId = await databaseService.saveImageData(
          userId,
          imageName,
          originalKey,
          processedKey
        );
      } catch (dbError) {
        console.log('DB save failed in dev, continuing:', dbError.message);
        dbImageId = imageId; // Use generated ID as fallback
      }
    } else {
    // ===== DEV-ONLY END =====
      // Save to database
      dbImageId = await databaseService.saveImageData(
        userId,
        imageName,
        originalKey,
        processedKey
      );

      // Log the activity
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
      processedUrl: processedKey
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