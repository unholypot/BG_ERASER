const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const databaseService = require('../services/database');
const s3Service = require('../services/s3');

// Get all user images with presigned URLs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const images = await databaseService.getUserImages(userId);
    
    if (!images || images.length === 0) {
      return res.status(204).send();
    }
    
    // Generate presigned URLs for each image
    const imagesWithUrls = await Promise.all(
      images.map(async (img) => {
        const presignedUrl = await s3Service.getSignedImageUrl(img.processedS3Url);
        return {
          ...img,
          presignedUrl
        };
      })
    );
    
    res.json(imagesWithUrls);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch images'
    });
  }
});

// Get single image presigned URL
router.get('/url/:imageId', authenticateToken, async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;
    
    const image = await databaseService.getImageById(imageId, userId);
    
    if (!image) {
      return res.status(404).json({
        error: true,
        message: 'Image not found'
      });
    }
    
    const originalUrl = await s3Service.getSignedImageUrl(image.originalS3Url);
    const processedUrl = await s3Service.getSignedImageUrl(image.processedS3Url);
    
    res.json({
      originalUrl,
      processedUrl,
      imageName: image.imageName
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: 'Failed to get image URLs'
    });
  }
});

// Add this new route for downloading images
router.get('/download/:imageId', async (req, res) => {
  try {
    // Get token from query parameter for download requests
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: true,
        message: 'Access token required'
      });
    }
    
    // Verify token manually
    const jwt = require('jsonwebtoken');
    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: true,
        message: 'Invalid or expired token'
      });
    }
    
    const { imageId } = req.params;
    const userId = user.userId;
    
    const image = await databaseService.getImageById(imageId, userId);
    
    if (!image) {
      return res.status(404).json({
        error: true,
        message: 'Image not found'
      });
    }
    
    // Get the image stream from S3
    const imageStream = await s3Service.getImageStream(image.processedS3Url);
    
    // Set headers for download
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${image.imageName}_processed.png"`);
    
    // Pipe the stream to response
    imageStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to download image'
    });
  }
});

module.exports = router;