require('dotenv').config();
const express = require('express');
const cors = require('cors');
const winston = require('winston');
const path = require('path');

// Import routes
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const imageRoutes = require('./routes/images');
const logRoutes = require('./routes/logs');

// Initialize express app
const app = express();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/users', userRoutes);
app.use('/upload', uploadRoutes);
app.use('/images', imageRoutes);
app.use('/logs', logRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== DEV-ONLY BEGIN =====
// Serve local images in development
if (process.env.NODE_ENV === 'development') {
  // Serve static files from uploads directory
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  
  // Legacy route for compatibility
  app.get('/local-image/:key', (req, res) => {
    const fs = require('fs');
    const filePath = path.join(__dirname, '../uploads', req.params.key.replace(/\//g, '_'));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('Image not found');
    } 
  });
}
// ===== DEV-ONLY END =====

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server is running on http://localhost:${PORT}`);
});