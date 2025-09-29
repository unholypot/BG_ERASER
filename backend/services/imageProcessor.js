const fs = require('fs').promises;
const path = require('path');

class ImageProcessorService {
  constructor() {
    this.initialized = false;
    this.removeBackground = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Dynamically import the ESM module
      const bgRemoval = await import('@imgly/background-removal-node');
      this.removeBackground = bgRemoval.removeBackground;
      this.initialized = true;
      console.log('Background removal library loaded');
    } catch (error) {
      console.error('Failed to load background removal library:', error);
      throw error;
    }
  }

  async processImage(inputBuffer, outputFormat = 'png', mimeType) {
    try {
      // Ensure initialization
      await this.initialize();
      
      // ===== DEV-ONLY BEGIN =====
      if (process.env.NODE_ENV === 'development') {
        console.log(`Processing buffer: ${inputBuffer.length} bytes, MIME: ${mimeType}`);
      }
      // ===== DEV-ONLY END =====
      
      // The library needs a Blob, not a Buffer or Uint8Array
      // Create a Blob from the buffer with proper MIME type
      const { Blob } = require('buffer');
      const blob = new Blob([inputBuffer], { type: mimeType || 'image/png' });
      
      // Process with the library - it handles Blob directly
      const resultBlob = await this.removeBackground(blob);
      
      // Convert result blob back to buffer
      const arrayBuffer = await resultBlob.arrayBuffer();
      const resultBuffer = Buffer.from(arrayBuffer);
      
      return {
        buffer: resultBuffer,
        mimeType: `image/${outputFormat}`
      };
    } catch (error) {
      console.error('Image processing error:', error);
      
      // ===== DEV-ONLY BEGIN =====
      // Fallback: use sharp for simple background processing
      if (process.env.NODE_ENV === 'development') {
        console.log('Attempting sharp fallback...');
        try {
          const sharp = require('sharp');
          const processedBuffer = await sharp(inputBuffer)
            .ensureAlpha()
            .png()
            .toBuffer();
          
          console.log('Sharp fallback successful');
          return {
            buffer: processedBuffer,
            mimeType: 'image/png'
          };
        } catch (sharpError) {
          console.error('Sharp fallback also failed:', sharpError);
        }
      }
      // ===== DEV-ONLY END =====
      
      throw new Error('Failed to process image: ' + error.message);
    }
  }
}

module.exports = new ImageProcessorService();