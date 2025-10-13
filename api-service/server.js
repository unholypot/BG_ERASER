require('dotenv').config();
const express = require('express');
const cors = require('cors');
const winston = require('winston');

// Import routes
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const imageRoutes = require('./routes/images');
const logRoutes = require('./routes/logs');

const app = express();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check for ALB
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api' });
});

// Routes
app.use('/users', userRoutes);
app.use('/upload', uploadRoutes);
app.use('/images', imageRoutes);
app.use('/logs', logRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`API Service running on port ${PORT}`);
  console.log(`API Service is running on http://localhost:${PORT}`);
});