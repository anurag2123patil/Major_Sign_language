const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided or invalid format.' 
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Token is invalid. User not found.' 
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated.' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token.' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired.' 
      });
    } else {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ 
        message: 'Internal server error during authentication.' 
      });
    }
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required.' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${roles.join(' or ')}.` 
      });
    }
    
    next();
  };
};

// Check if user is teacher of a class
const isClassTeacher = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const Class = require('../models/Class');
    
    const classData = await Class.findById(classId);
    
    if (!classData) {
      return res.status(404).json({ 
        message: 'Class not found.' 
      });
    }
    
    if (!classData.teacherId.equals(req.user._id)) {
      return res.status(403).json({ 
        message: 'Access denied. Only class teacher can perform this action.' 
      });
    }
    
    req.classData = classData;
    next();
  } catch (error) {
    console.error('Class teacher check error:', error);
    return res.status(500).json({ 
      message: 'Internal server error.' 
    });
  }
};

// Check if user is student in a class
const isClassStudent = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const Class = require('../models/Class');
    
    const classData = await Class.findById(classId);
    
    if (!classData) {
      return res.status(404).json({ 
        message: 'Class not found.' 
      });
    }
    
    if (req.user.role !== 'student' || !classData.students.some(id => id.equals(req.user._id))) {
      return res.status(403).json({ 
        message: 'Access denied. Only enrolled students can access this class.' 
      });
    }
    
    req.classData = classData;
    next();
  } catch (error) {
    console.error('Class student check error:', error);
    return res.status(500).json({ 
      message: 'Internal server error.' 
    });
  }
};

// Check if user is parent of a student
const isParentOfStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    
    if (req.user.role !== 'parent') {
      return res.status(403).json({ 
        message: 'Access denied. Only parents can access this resource.' 
      });
    }
    
    const student = await User.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found.' 
      });
    }
    
    // Check if the student's parentEmail matches the parent's email
    if (student.studentInfo?.parentEmail !== req.user.email) {
      return res.status(403).json({ 
        message: 'Access denied. You can only access your own child\'s data.' 
      });
    }
    
    req.studentData = student;
    next();
  } catch (error) {
    console.error('Parent check error:', error);
    return res.status(500).json({ 
      message: 'Internal server error.' 
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authorize,
  isClassTeacher,
  isClassStudent,
  isParentOfStudent,
  optionalAuth
};
