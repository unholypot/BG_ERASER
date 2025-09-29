const fs = require('fs').promises;
const path = require('path');

class LocalStorageService {
  constructor() {
    this.baseDir = path.join(__dirname, '../../uploads');
    this.originalDir = path.join(this.baseDir, 'original');
    this.processedDir = path.join(this.baseDir, 'processed');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.originalDir, { recursive: true });
      await fs.mkdir(this.processedDir, { recursive: true });
    } catch (err) {
      console.error('Error creating directories:', err);
    }
  }

  async uploadProcessedImage(key, buffer, contentType) {
    // ===== DEV-ONLY BEGIN =====
    // Determine which directory based on key
    const isProcessed = key.includes('processed');
    const targetDir = isProcessed ? this.processedDir : this.originalDir;
    
    // Clean up the filename
    const cleanKey = key.split('/').pop(); // Get just the filename
    const filePath = path.join(targetDir, cleanKey);
    
    await fs.writeFile(filePath, buffer);
    console.log(`Saved file to: ${filePath}`);
    
    // Return relative path for URL construction
    const relativePath = isProcessed ? `processed/${cleanKey}` : `original/${cleanKey}`;
    return { success: true, key: relativePath };
    // ===== DEV-ONLY END =====
  }

  async getImageStream(key) {
    // ===== DEV-ONLY BEGIN =====
    // Try multiple possible locations
    const possiblePaths = [
      path.join(this.processedDir, key),
      path.join(this.processedDir, key.split('/').pop()),
      path.join(this.originalDir, key),
      path.join(this.originalDir, key.split('/').pop()),
      path.join(this.baseDir, key),
    ];

    for (const filePath of possiblePaths) {
      try {
        const buffer = await fs.readFile(filePath);
        console.log(`Found file at: ${filePath}`);
        return {
          pipe: (res) => res.send(buffer)
        };
      } catch (err) {
        // Continue to next path
      }
    }
    
    throw new Error(`File not found: ${key}`);
    // ===== DEV-ONLY END =====
  }

  async listUserImages(userId) {
    // ===== DEV-ONLY BEGIN =====
    try {
      const processedFiles = await fs.readdir(this.processedDir);
      const images = [];
      
      for (const file of processedFiles) {
        if (file.includes(userId) || process.env.NODE_ENV === 'development') {
          images.push({
            Key: `processed/${file}`,
            filename: file
          });
        }
      }
      
      return images;
    } catch {
      return [];
    }
    // ===== DEV-ONLY END =====
  }

  async getSignedImageUrl(key) {
    // ===== DEV-ONLY BEGIN =====
    // Return direct URL for local development
    return `http://localhost:3001/uploads/${key}`;
    // ===== DEV-ONLY END =====
  }
}

module.exports = new LocalStorageService();