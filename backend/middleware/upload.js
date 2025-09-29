const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client } = require('../config/aws');
const { v4: uuidv4 } = require('uuid');

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.S3_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const userId = req.user.userId;
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${userId}/${uuidv4()}.${fileExtension}`;
      cb(null, fileName);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

module.exports = upload;