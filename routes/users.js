const express = require('express');
const { param, query } = require('express-validator');
const { verifyToken, authorize } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Get all users (admin functionality - can be restricted)
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = { isActive: true };
    if (role) query.role = role;

    // Get paginated results
    const skip = (page - 1) * limit;
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password')
      .populate('studentInfo.classIds', 'name subject')
      .populate('teacherInfo.classIds', 'name subject')
      .populate('parentInfo.children', 'name email');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Validation rules
const userIdValidation = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format')
];

const queryValidation = [
  query('role')
    .optional()
    .isIn(['student', 'teacher', 'parent'])
    .withMessage('Invalid role'),
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
// Get all users (accessible by teachers and admins)
router.get('/', verifyToken, authorize('teacher', 'parent'), queryValidation, getAllUsers);

// Get user by ID
router.get('/:userId', verifyToken, userIdValidation, getUserById);

module.exports = router;
