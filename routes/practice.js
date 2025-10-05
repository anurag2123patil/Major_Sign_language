const express = require('express');
const { body, param, query } = require('express-validator');
const { verifyToken, authorize } = require('../middleware/auth');
const {
  savePractice,
  getPracticeHistory,
  getPracticeStats,
  getStudentPracticeAnalytics,
  updatePractice,
  deletePractice
} = require('../controllers/practiceController');

const router = express.Router();

// Validation rules
const savePracticeValidation = [
  body('type')
    .isIn(['writing', 'typing', 'drawing'])
    .withMessage('Type must be writing, typing, or drawing'),
  body('category')
    .isIn(['alphabet', 'number', 'word', 'sentence', 'math', 'science', 'general'])
    .withMessage('Invalid category'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content is required and must be less than 2000 characters'),
  body('targetContent')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Target content must be less than 2000 characters'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Accuracy must be between 0 and 100'),
  body('strokes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Strokes must be a non-negative integer'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a non-negative integer'),
  body('attempts')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Attempts must be a positive integer'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  body('classId')
    .optional()
    .isMongoId()
    .withMessage('Invalid class ID format'),
  body('assignmentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid assignment ID format')
];

const updatePracticeValidation = [
  body('accuracy')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Accuracy must be between 0 and 100'),
  body('strokes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Strokes must be a non-negative integer'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a non-negative integer'),
  body('attempts')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Attempts must be a positive integer'),
  body('isCompleted')
    .optional()
    .isBoolean()
    .withMessage('isCompleted must be a boolean value'),
  body('score')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Score must be a non-negative number'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feedback must be less than 500 characters')
];

const objectIdValidation = [
  param('practiceId')
    .isMongoId()
    .withMessage('Invalid practice ID format')
];

const studentIdValidation = [
  param('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format')
];

const classIdValidation = [
  param('classId')
    .isMongoId()
    .withMessage('Invalid class ID format')
];

const queryValidation = [
  query('type')
    .optional()
    .isIn(['writing', 'typing', 'drawing'])
    .withMessage('Invalid practice type'),
  query('category')
    .optional()
    .isIn(['alphabet', 'number', 'word', 'sentence', 'math', 'science', 'general'])
    .withMessage('Invalid category'),
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Period must be day, week, month, or year'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Routes
// Save practice session (student only)
router.post('/', verifyToken, authorize('student'), savePracticeValidation, savePractice);

// Get practice history (student only)
router.get('/history', verifyToken, authorize('student'), queryValidation, getPracticeHistory);

// Get practice statistics (student only)
router.get('/stats', verifyToken, authorize('student'), queryValidation, getPracticeStats);

// Get student practice analytics (teacher only)
router.get('/analytics/:studentId/:classId', verifyToken, authorize('teacher'), studentIdValidation, classIdValidation, queryValidation, getStudentPracticeAnalytics);

// Update practice session (student only)
router.put('/:practiceId', verifyToken, authorize('student'), objectIdValidation, updatePracticeValidation, updatePractice);

// Delete practice session (student only)
router.delete('/:practiceId', verifyToken, authorize('student'), objectIdValidation, deletePractice);

module.exports = router;
