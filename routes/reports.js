const express = require('express');
const { param, query } = require('express-validator');
const { verifyToken, authorize } = require('../middleware/auth');
const {
  getStudentProgressReport,
  getClassAnalytics,
  getParentDashboard
} = require('../controllers/reportController');

const router = express.Router();

// Validation rules
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
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year'])
    .withMessage('Period must be week, month, quarter, or year')
];

// Routes
// Get student progress report (accessible by student, parent, and teacher)
router.get('/student/:studentId', verifyToken, studentIdValidation, queryValidation, getStudentProgressReport);

// Get class analytics (teacher only)
router.get('/class/:classId', verifyToken, authorize('teacher'), classIdValidation, queryValidation, getClassAnalytics);

// Get parent dashboard (parent only)
router.get('/parent/dashboard', verifyToken, authorize('parent'), getParentDashboard);

module.exports = router;
