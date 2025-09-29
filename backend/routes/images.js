// File: backend/routes/images.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const databaseService = require('../services/database');
const path = require('path');
const fs = require('fs');

// ===== DEV-ONLY BEGIN =====
const s3Service = process.env.NODE_ENV === 'development'
  ? require('../services/localStorage')
  : require('../services/s3');
// ===== DEV-ONLY END =====

// Get all user images
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // ===== DEV-ONLY BEGIN =====
    if (process.env.NODE_ENV === 'development') {
      const uploadsDir = path.join(__dirname, '../../uploads/processed');
      
      try {
        const files = fs.readdirSync(uploadsDir);
        const userFiles = files.filter(f => f.endsWith('.png'));
        
        if (userFiles.length === 0) {
          return res.status(204).send();
        }
        
        const images = userFiles.map((file, index) => ({
          imageId: index + 1,
          imageName: file.replace('processed_', '').replace(`${userId}_`, '').replace('.png', ''),
          timestamp: new Date().toISOString(),
          processedS3Url: `processed/${file}`,
          filename: file
        }));
        
        return res.json(images);
      } catch (err) {
        console.log('Error reading uploads directory:', err);
        return res.status(204).send();
      }
    }
    // ===== DEV-ONLY END =====
    
    const images = await databaseService.getUserImages(userId);
    
    if (!images || images.length === 0) {
      return res.status(204).send();
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

// Get single image by filename - FIXED
router.get('/retrieve', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({
        error: true,
        message: 'Filename query parameter is required'
      });
    }

    // ===== DEV-ONLY BEGIN =====
    if (process.env.NODE_ENV === 'development') {
      const baseDir = path.join(__dirname, '../../uploads');
      
      // Try different possible paths
      const possiblePaths = [
        path.join(baseDir, filename),
        path.join(baseDir, 'processed', filename.split('/').pop()),
        path.join(baseDir, 'original', filename.split('/').pop()),
        path.join(baseDir, 'processed', filename.replace('processed/', ''))
      ];
      
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log(`Serving image from: ${filePath}`);
          return res.sendFile(filePath);
        }
      }
      
      console.log('Image not found, tried paths:', possiblePaths);
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