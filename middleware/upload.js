const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Ensure upload directories exist
const ensureUploadDirs = async () => {
  const dirs = [
    'uploads/videos',
    'uploads/images',
    'uploads/documents',
    'uploads/thumbnails'
  ];
  
  for (const dir of dirs) {
    await fs.ensureDir(path.join(__dirname, '..', dir));
  }
};

// Initialize directories
ensureUploadDirs();

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/mov': '.mov',
    'video/wmv': '.wmv',
    'video/webm': '.webm',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt'
  };
  
  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${Object.keys(allowedTypes).join(', ')}`), false);
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    // Determine upload directory based on file type
    if (file.mimetype.startsWith('video/')) {
      uploadPath += 'videos/';
    } else if (file.mimetype.startsWith('image/')) {
      uploadPath += 'images/';
    } else {
      uploadPath += 'documents/';
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const name = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${name}_${uniqueSuffix}${extension}`);
  }
});

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Maximum 10 files per request
  }
});

// Upload middleware for single file
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'File too large. Maximum size is 100MB.'
          });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            message: 'Too many files. Maximum is 10 files per request.'
          });
        } else {
          return res.status(400).json({
            message: `Upload error: ${err.message}`
          });
        }
      } else if (err) {
        return res.status(400).json({
          message: err.message
        });
      }
      
      next();
    });
  };
};

// Upload middleware for multiple files
const uploadMultiple = (fieldName, maxCount = 10) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, maxCount);
    
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'File too large. Maximum size is 100MB.'
          });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            message: `Too many files. Maximum is ${maxCount} files per request.`
          });
        } else {
          return res.status(400).json({
            message: `Upload error: ${err.message}`
          });
        }
      } else if (err) {
        return res.status(400).json({
          message: err.message
        });
      }
      
      next();
    });
  };
};

// Upload middleware for specific file types
const uploadVideo = uploadSingle('video');
const uploadImage = uploadSingle('image');
const uploadDocument = uploadSingle('document');
const uploadMultipleFiles = uploadMultiple('files');

// Helper function to delete file
const deleteFile = async (filePath) => {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    await fs.remove(fullPath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Helper function to get file info
const getFileInfo = (file) => {
  if (!file) return null;
  
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    encoding: file.encoding
  };
};

// Middleware to clean up uploaded files on error
const cleanupFiles = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // If response is an error, clean up uploaded files
    if (res.statusCode >= 400 && req.files) {
      req.files.forEach(file => {
        deleteFile(file.path);
      });
    } else if (res.statusCode >= 400 && req.file) {
      deleteFile(req.file.path);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadVideo,
  uploadImage,
  uploadDocument,
  uploadMultipleFiles,
  deleteFile,
  getFileInfo,
  cleanupFiles,
  ensureUploadDirs
};
