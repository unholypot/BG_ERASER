const fs = require('fs').promises;
const path = require('path');

class LocalStorageService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.ensureDirectory();
  }

  async ensureDirectory() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (err) {
      console.error('Error creating uploads directory:', err);
    }
  }

  async uploadProcessedImage(key, buffer, contentType) {
    const filePath = path.join(this.uploadsDir, key.replace(/\//g, '_'));
    await fs.writeFile(filePath, buffer);
    return { success: true, key };
  }

  async getImageStream(key) {
    const filePath = path.join(this.uploadsDir, key.replace(/\//g, '_'));
    const buffer = await fs.readFile(filePath);
    // Return a mock stream-like object
    return {
      pipe: (res) => res.send(buffer)
    };
  }

  async listUserImages(userId) {
    try {
      const files = await fs.readdir(this.uploadsDir);
      return files
        .filter(f => f.startsWith(userId))
        .map(f => ({ Key: f }));
    } catch {
      return [];
    }
  }

  async getSignedImageUrl(key) {
    return `http://localhost:3001/local-image/${key}`;
  }
}

module.exports = new LocalStorageService();