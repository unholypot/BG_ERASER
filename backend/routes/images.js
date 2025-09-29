const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const databaseService = require('../services/database');

// ===== DEV-ONLY BEGIN =====
const s3Service = process.env.NODE_ENV === 'development'
  ? require('../services/localStorage')
  : require('../services/s3');
// ===== DEV-ONLY END =====

// Get all user images - matching MyBackgroundEraser's /images endpoint
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // ===== DEV-ONLY BEGIN =====
    if (process.env.NODE_ENV === 'development') {
      // In dev mode, return mock data or check local files
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../../uploads');
      
      try {
        const files = fs.readdirSync(uploadsDir);
        const userFiles = files.filter(f => f.includes('processed'));
        
        if (userFiles.length === 0) {
          return res.status(204).send(); // No content
        }
        
        // Create mock image data matching the expected format
        const images = userFiles.map((file, index) => ({
          imageId: index + 1,
          imageName: file.replace('_processed_', '_').replace('.png', ''),
          timestamp: new Date().toISOString(),
          processedS3Url: file
        }));
        
        return res.json(images);
      } catch (err) {
        console.log('Dev mode: No uploads directory or files');
        return res.status(204).send();
      }
    }
    // ===== DEV-ONLY END =====
    
    const images = await databaseService.getUserImages(userId);
    
    if (!images || images.length === 0) {
      return res.status(204).send(); // No content, matching the reference
    }
    
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch images'
    });
  }
});

// Get single image by filename - matching MyBackgroundEraser's /retrieve endpoint
router.get('/retrieve', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.query;
    const userId = req.user.userId;
    
    if (!filename) {
      return res.status(400).json({
        error: true,
        message: 'Filename query parameter is required'
      });
    }

    // ===== DEV-ONLY BEGIN =====
    if (process.env.NODE_ENV === 'development') {
      const fs = require('fs');
      const path = require('path');
      
      // Check different possible file locations
      const possibleFiles = [
        path.join(__dirname, '../../uploads', filename),
        path.join(__dirname, '../../uploads', `${userId}_processed_${filename}.png`),
        path.join(__dirname, '../../uploads', filename.replace(/\//g, '_')),
        path.join(__dirname, '../../uploads', 'debug_output.png') // Fallback to debug output
      ];
      
      for (const filePath of possibleFiles) {
        if (fs.existsSync(filePath)) {
          console.log(`Serving file: ${filePath}`);
          res.setHeader('Content-Type', 'image/png');
          return res.sendFile(filePath);
        }
      }
      
      console.log('File not found, tried:', possibleFiles);
      return res.status(404).json({
        error: true,
        message: 'Image not found'
      });
    }
    // ===== DEV-ONLY END =====

    // Production: Get image stream from S3
    const imageStream = await s3Service.getImageStream(filename);
    res.setHeader('Content-Type', 'image/png');
    imageStream.pipe(res);
  } catch (error) {
    console.error('Retrieve error:', error);
    res.status(404).json({
      error: true,
      message: 'Image not found'
    });
  }
});

module.exports = router;