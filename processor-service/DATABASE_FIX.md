# Database Schema Fix - Summary

## Issues Fixed

### 1. Database Schema Mismatch ✅
**Problem:** `updateImageStatus()` was trying to update `status` and `updatedAt` columns that didn't exist in the `image_data` table.

**Solution:**
- Added `status` column (default: 'pending') to track processing state
- Added `updatedAt` column to track when status changes
- Added index on `status` column for efficient queries
- Implemented automatic migration for existing tables that checks if columns exist and adds them if missing

### 2. No Database Initialization ✅
**Problem:** Service never called `createTables()` on startup, which could cause issues if tables don't exist or need migration.

**Solution:**
- Added database initialization at the start of `pollQueue()` function
- Service now verifies/creates tables before processing any messages
- If initialization fails, service exits with code 1 and logs the error
- CloudWatch Logs will show: "Initializing database tables..." and "Database tables verified/created successfully"

## Changes Made

### File: `services/database.js`
```javascript
// NEW: image_data table now includes:
- status column (string, default: 'pending')
- updatedAt column (timestamp, default: now())
- index on status column

// NEW: Automatic migration logic
- Checks if table exists
- If exists, checks for missing columns
- Adds missing columns without affecting existing data
```

### File: `processor.js`
```javascript
// NEW: Database initialization on startup
async function pollQueue() {
  logger.info('Processor service started');
  
  // Initialize database tables on startup
  try {
    logger.info('Initializing database tables...');
    await databaseService.createTables();
    logger.info('Database tables verified/created successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
  
  // ... rest of polling logic
}
```

## Database Schema

### image_data table (updated)
```sql
CREATE TABLE image_data (
  "imageId" SERIAL PRIMARY KEY,
  "userId" VARCHAR NOT NULL,
  "imageName" VARCHAR NOT NULL,
  "originalS3Url" VARCHAR NOT NULL,
  "processedS3Url" VARCHAR NOT NULL,
  "status" VARCHAR DEFAULT 'pending',        -- NEW
  "timestamp" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),       -- NEW
  INDEX idx_userId ("userId"),
  INDEX idx_status ("status")                -- NEW
);
```

### Status Values
- `pending` - Image uploaded, waiting for processing
- `completed` - Background removal successful
- `failed` - Processing failed

## Testing

### Verify the fix locally:
```bash
# Set environment variables
export DB_HOST=your-host
export DB_PORT=5432
export DB_NAME=bgremover
export DB_USER=postgres
export DB_PASSWORD=your-password
export DB_SSL=true

# Run the service
node processor.js
```

### Expected logs:
```
Processor service started
Initializing database tables...
Database tables verified/created successfully
```

### For existing databases:
If your database already has the `image_data` table without the new columns, the service will automatically add them on the first startup. You'll see the same success message.

## Deployment to ECS

No additional changes needed for ECS deployment. The service will:
1. Start up
2. Check/create database tables
3. Add missing columns to existing tables (if needed)
4. Begin processing messages from SQS

If database initialization fails (wrong credentials, network issues, etc.), the container will exit with code 1, and ECS will show the failure in CloudWatch Logs.

## Rollback Safety

✅ **Safe to deploy** - The migration is non-destructive:
- Existing data is preserved
- New columns have default values
- If columns already exist, they won't be recreated
- If deployment fails, you can rollback without data loss
