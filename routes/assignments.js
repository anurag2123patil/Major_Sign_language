const express = require('express');
const { body, param, query } = require('express-validator');
const { verifyToken, authorize, isClassTeacher } = require('../middleware/auth');
const {
  createAssignment,
  getClassAssignments,
  getAssignmentById,
  submitAssignment,
  gradeAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentSubmissions
} = require('../controllers/assignmentController');

const router = express.Router();

// Validation rules
const createAssignmentValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Instructions must be less than 2000 characters'),
  body('questions')
    .isArray({ min: 1 })
    .withMessage('At least one question is required'),
  body('questions.*.questionText')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Question text is required and must be less than 1000 characters'),
  body('questions.*.questionType')
    .optional()
    .isIn(['multiple_choice', 'short_answer', 'long_answer', 'true_false'])
    .withMessage('Invalid question type'),
  body('questions.*.points')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('classId')
    .isMongoId()
    .withMessage('Invalid class ID format'),
  body('allowLateSubmission')
    .optional()
    .isBoolean()
    .withMessage('allowLateSubmission must be a boolean value'),
  body('latePenalty')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Late penalty must be between 0 and 100')
];

const updateAssignmentValidation = [
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
  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Instructions must be less than 2000 characters'),
  body('questions')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one question is required'),
  body('questions.*.questionText')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Question text is required and must be less than 1000 characters'),
  body('questions.*.questionType')
    .optional()
    .isIn(['multiple_choice', 'short_answer', 'long_answer', 'true_false'])
    .withMessage('Invalid question type'),
  body('questions.*.points')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('allowLateSubmission')
    .optional()
    .isBoolean()
    .withMessage('allowLateSubmission must be a boolean value'),
  body('latePenalty')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Late penalty must be between 0 and 100'),
  body('isPublished')
    .optional()
    .isBoolean()
    .withMessage('isPublished must be a boolean value')
];

const submitAssignmentValidation = [
  body('answers')
    .isArray({ min: 1 })
    .withMessage('At least one answer is required'),
  body('answers.*.questionId')
    .isMongoId()
    .withMessage('Invalid question ID format'),
  body('answers.*.answer')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Answer is required and must be less than 2000 characters')
];

const gradeAssignmentValidation = [
  body('score')
    .isFloat({ min: 0 })
    .withMessage('Score must be a positive number'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters')
];

const objectIdValidation = [
  param('assignmentId')
    .isMongoId()
    .withMessage('Invalid assignment ID format')
];

const classIdValidation = [
  param('classId')
    .isMongoId()
    .withMessage('Invalid class ID format')
];

const studentIdValidation = [
  param('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format')
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
  query('status')
    .optional()
    .isIn(['submitted', 'pending'])
    .withMessage('Status must be submitted or pending')
];

// Routes
// Create assignment (teacher only)
router.post('/', verifyToken, authorize('teacher'), createAssignmentValidation, createAssignment);

// Get assignments for a class
router.get('/class/:classId', verifyToken, classIdValidation, paginationValidation, getClassAssignments);

// Get assignment by ID
router.get('/:assignmentId', verifyToken, objectIdValidation, getAssignmentById);

// Submit assignment (student only)
router.post('/:assignmentId/submit', verifyToken, authorize('student'), objectIdValidation, submitAssignmentValidation, submitAssignment);

// Grade assignment (teacher only)
router.put('/:assignmentId/grade/:studentId', verifyToken, authorize('teacher'), objectIdValidation, studentIdValidation, gradeAssignmentValidation, gradeAssignment);

// Update assignment (teacher only)
router.put('/:assignmentId', verifyToken, authorize('teacher'), objectIdValidation, updateAssignmentValidation, updateAssignment);

// Delete assignment (teacher only)
router.delete('/:assignmentId', verifyToken, authorize('teacher'), objectIdValidation, deleteAssignment);

// Get assignment submissions (teacher only)
router.get('/:assignmentId/submissions', verifyToken, authorize('teacher'), objectIdValidation, getAssignmentSubmissions);

module.exports = router;
