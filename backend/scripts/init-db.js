require('dotenv').config();
const databaseService = require('../services/database');

async function initializeDatabase() {
  try {
    console.log('Initializing database tables...');
    await databaseService.createTables();
    console.log('Database tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}
initializeDatabase();