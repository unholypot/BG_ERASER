
const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  searchPath: [process.env.DB_USER, 'public'],
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
  }
});

class DatabaseService {
  async createTables() {
    if (!(await knex.schema.hasTable('image_data'))) {
      await knex.schema.createTable('image_data', table => {
        table.increments('imageId').primary();
        table.string('userId').notNullable();
        table.string('imageName').notNullable();
        table.string('originalS3Url').notNullable();
        table.string('processedS3Url').notNullable();
        table.string('status').defaultTo('pending'); // Add status column
        table.timestamp('timestamp').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.fn.now()); // Add updatedAt column
        table.index('userId');
        table.index('status');
      });
    } else {
      // Add columns if they don't exist (for existing tables)
      const hasStatus = await knex.schema.hasColumn('image_data', 'status');
      const hasUpdatedAt = await knex.schema.hasColumn('image_data', 'updatedAt');
      
      if (!hasStatus || !hasUpdatedAt) {
        await knex.schema.alterTable('image_data', table => {
          if (!hasStatus) {
            table.string('status').defaultTo('pending');
          }
          if (!hasUpdatedAt) {
            table.timestamp('updatedAt').defaultTo(knex.fn.now());
          }
        });
      }
    }

    if (!(await knex.schema.hasTable('logs'))) {
      await knex.schema.createTable('logs', table => {
        table.increments('logId').primary();
        table.string('userId').notNullable();
        table.integer('imageId').unsigned();
        table.string('description').notNullable();
        table.timestamp('timestamp').defaultTo(knex.fn.now());
        table.foreign('imageId').references('imageId').inTable('image_data');
        table.index('userId');
      });
    }
  }


async saveImageData(userId, imageName, originalS3Url, processedS3Url) {
  const result = await knex('image_data').insert({
    userId,
    imageName,
    originalS3Url,
    processedS3Url
  }).returning('imageId');
  
  // PostgreSQL returns an array with objects, MySQL returns just the ID
  return result[0].imageId || result[0];
}

  async saveLog(userId, description, imageId = null) {
    await knex('logs').insert({
      userId,
      description,
      imageId
    });
  }

  async getUserImages(userId) {
    return await knex('image_data')
      .where('userId', userId)
      .orderBy('timestamp', 'desc')
      .select('imageId', 'imageName', 'timestamp', 'processedS3Url');
  }

  async getUserLogs(userId) {
    return await knex('logs')
      .where('userId', userId)
      .orderBy('timestamp', 'desc')
      .select('logId', 'description', 'imageId', 'timestamp');
  }

  async getImageById(imageId, userId) {
    return await knex('image_data')
      .where({ imageId, userId })
      .first();
  }
  
  async updateImageStatus(imageId, status) {
    return await knex('image_data')
      .where('imageId', imageId)
      .update({
        status,
        updatedAt: knex.fn.now()
    });
}
  
}
module.exports = new DatabaseService();
