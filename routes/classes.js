const express = require('express');
const { body, param } = require('express-validator');
const { verifyToken, authorize, isClassTeacher, isClassStudent } = require('../middleware/auth');
const {
  createClass,
  getTeacherClasses,
  getStudentClasses,
  getClassById,
  joinClassByCode,
  addStudentToClass,
  removeStudentFromClass,
  updateClass,
  deleteClass,
  getClassStats
} = require('../controllers/classController');

const router = express.Router();

// Validation rules
const createClassValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Class name is required and must be less than 100 characters'),
  body('subject')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Subject is required and must be less than 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('maxStudents')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Max students must be between 1 and 100')
];

const joinClassValidation = [
  body('classCode')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Class code must be exactly 6 characters')
];

const addStudentValidation = [
  body('studentEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid student email')
];

const updateClassValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Class name must be less than 100 characters'),
  body('subject')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Subject must be less than 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('maxStudents')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Max students must be between 1 and 100'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

const objectIdValidation = [
  param('classId')
    .isMongoId()
    .withMessage('Invalid class ID format')
];

const studentIdValidation = [
  param('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format')
];

// Routes
// Create class (teacher only)
router.post('/', verifyToken, authorize('teacher'), createClassValidation, createClass);

// Get classes for teacher
router.get('/teacher', verifyToken, authorize('teacher'), getTeacherClasses);

// Get classes for student
router.get('/student', verifyToken, authorize('student'), getStudentClasses);

// Join class by code (student only)
router.post('/join', verifyToken, authorize('student'), joinClassValidation, joinClassByCode);

// Get class by ID (accessible by teacher and enrolled students)
router.get('/:classId', verifyToken, objectIdValidation, getClassById);

// Get class statistics (teacher only)
router.get('/:classId/stats', verifyToken, authorize('teacher'), isClassTeacher, getClassStats);

// Update class (teacher only)
router.put('/:classId', verifyToken, authorize('teacher'), isClassTeacher, updateClassValidation, updateClass);

// Add student to class (teacher only)
router.post('/:classId/students', verifyToken, authorize('teacher'), isClassTeacher, addStudentValidation, addStudentToClass);

// Remove student from class (teacher only)
router.delete('/:classId/students/:studentId', verifyToken, authorize('teacher'), isClassTeacher, studentIdValidation, removeStudentFromClass);

// Delete class (teacher only)
router.delete('/:classId', verifyToken, authorize('teacher'), isClassTeacher, deleteClass);

module.exports = router;
