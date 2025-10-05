const express = require('express');
const { body, param, query } = require('express-validator');
const { verifyToken, authorize, isClassTeacher } = require('../middleware/auth');
const { uploadVideo, uploadImage, uploadDocument, cleanupFiles } = require('../middleware/upload');
const {
  uploadMedia,
  getClassMedia,
  getMediaById,
  recordView,
  updateMedia,
  deleteMedia,
  getMediaAnalytics
} = require('../controllers/mediaController');

const router = express.Router();

// Validation rules
const uploadMediaValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('category')
    .optional()
    .isIn(['alphabet', 'number', 'word', 'sentence', 'math', 'science', 'general'])
    .withMessage('Invalid category'),
  body('classId')
    .isMongoId()
    .withMessage('Invalid class ID format'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string')
];

const recordViewValidation = [
  body('percentage')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Percentage must be between 0 and 100')
];

const updateMediaValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('category')
    .optional()
    .isIn(['alphabet', 'number', 'word', 'sentence', 'math', 'science', 'general'])
    .withMessage('Invalid category'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value')
];

const objectIdValidation = [
  param('mediaId')
    .isMongoId()
    .withMessage('Invalid media ID format')
];

const classIdValidation = [
  param('classId')
    .isMongoId()
    .withMessage('Invalid class ID format')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('type')
    .optional()
    .isIn(['video', 'image', 'audio', 'document'])
    .withMessage('Invalid media type'),
  query('category')
    .optional()
    .isIn(['alphabet', 'number', 'word', 'sentence', 'math', 'science', 'general'])
    .withMessage('Invalid category')
];

// Routes
// Upload video (teacher only)
router.post('/upload/video', 
  verifyToken, 
  authorize('teacher'), 
  uploadVideo, 
  cleanupFiles,
  uploadMediaValidation, 
  uploadMedia
);

// Upload image (teacher only)
router.post('/upload/image', 
  verifyToken, 
  authorize('teacher'), 
  uploadImage, 
  cleanupFiles,
  uploadMediaValidation, 
  uploadMedia
);

// Upload document (teacher only)
router.post('/upload/document', 
  verifyToken, 
  authorize('teacher'), 
  uploadDocument, 
  cleanupFiles,
  uploadMediaValidation, 
  uploadMedia
);

// Get media for a class
router.get('/class/:classId', 
  verifyToken, 
  classIdValidation, 
  paginationValidation, 
  getClassMedia
);

// Get media by ID
router.get('/:mediaId', 
  verifyToken, 
  objectIdValidation, 
  getMediaById
);

// Record media view (student only)
router.post('/:mediaId/view', 
  verifyToken, 
  authorize('student'), 
  objectIdValidation, 
  recordViewValidation, 
  recordView
);

// Update media details (teacher only)
router.put('/:mediaId', 
  verifyToken, 
  authorize('teacher'), 
  objectIdValidation, 
  updateMediaValidation, 
  updateMedia
);

// Delete media (teacher only)
router.delete('/:mediaId', 
  verifyToken, 
  authorize('teacher'), 
  objectIdValidation, 
  deleteMedia
);

// Get media analytics for class (teacher only)
router.get('/analytics/:classId', 
  verifyToken, 
  authorize('teacher'), 
  classIdValidation, 
  getMediaAnalytics
);

module.exports = router;
