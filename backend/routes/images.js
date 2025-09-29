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
        
        const images = userFiles.map((file, index) => {
          // Clean up the image name for display
          const cleanName = file
            .replace('processed_', '')
            .replace('local_admin_', '')
            .replace(`${userId}_`, '')
            .replace('.png', '');
          
          return {
            imageId: index + 1,
            imageName: cleanName,
            timestamp: new Date().toISOString(),
            processedS3Url: file, // Just the filename, no path
            filename: file
          };
        });
        
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

// Get single image by filename - serve actual file
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
      const processedDir = path.join(__dirname, '../../uploads/processed');
      const originalDir = path.join(__dirname, '../../uploads/original');
      
      // Clean the filename (remove any path components)
      const cleanFilename = filename.split('/').pop();
      
      // Try processed directory first
      let filePath = path.join(processedDir, cleanFilename);
      
      if (!fs.existsSync(filePath)) {
        // Try original directory
        filePath = path.join(originalDir, cleanFilename);
      }
      
      if (fs.existsSync(filePath)) {
        console.log(`Serving image: ${cleanFilename} from ${filePath}`);
        
        // Determine content type
        const ext = path.extname(cleanFilename).toLowerCase();
        let contentType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.webp') contentType = 'image/webp';
        
        res.setHeader('Content-Type', contentType);
        return res.sendFile(filePath);
      }
      
      console.log(`Image not found: ${cleanFilename}`);
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