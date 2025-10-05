const Practice = require('../models/Practice');
const User = require('../models/User');
const Class = require('../models/Class');
const { validationResult } = require('express-validator');

// Save practice session
const savePractice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      type,
      category,
      content,
      targetContent,
      accuracy,
      strokes,
      timeSpent,
      attempts,
      difficulty,
      writingData,
      typingData,
      classId,
      assignmentId,
      deviceInfo
    } = req.body;

    const studentId = req.user._id;

    // Verify class access if classId is provided
    if (classId) {
      const classData = await Class.findById(classId);
      if (!classData || !classData.students.includes(studentId)) {
        return res.status(403).json({
          message: 'Access denied to this class'
        });
      }
    }

    // Create practice record
    const practice = new Practice({
      studentId,
      type,
      category,
      content,
      targetContent,
      accuracy: accuracy || 0,
      strokes: strokes || 0,
      timeSpent: timeSpent || 0,
      attempts: attempts || 1,
      difficulty: difficulty || 'easy',
      writingData,
      typingData,
      classId,
      assignmentId,
      deviceInfo
    });

    // Calculate metrics based on type
    if (type === 'typing' && typingData) {
      practice.calculateTypingMetrics();
    } else if (type === 'writing' && targetContent) {
      practice.evaluateWriting();
    }

    // Set completion status
    if (accuracy >= 80 || practice.attempts >= 3) {
      practice.isCompleted = true;
      practice.completionTime = timeSpent;
    }

    await practice.save();

    // Populate related fields
    await practice.populate('studentId', 'name email');
    if (classId) {
      await practice.populate('classId', 'name subject');
    }

    res.status(201).json({
      message: 'Practice session saved successfully',
      practice
    });
  } catch (error) {
    console.error('Save practice error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get practice history for student
const getPracticeHistory = async (req, res) => {
  try {
    const { type, category, page = 1, limit = 10 } = req.query;
    const studentId = req.user._id;

    // Build query
    const query = { studentId, isActive: true };
    if (type) query.type = type;
    if (category) query.category = category;

    // Get paginated results
    const skip = (page - 1) * limit;
    const practices = await Practice.find(query)
      .populate('classId', 'name subject')
      .populate('assignmentId', 'title')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Practice.countDocuments(query);

    res.json({
      practices,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get practice history error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get practice statistics for student
const getPracticeStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const studentId = req.user._id;

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get statistics by type
    const stats = await Practice.getStudentStats(studentId, {
      start: startDate,
      end: now
    });

    // Get category-wise statistics
    const categoryStats = await Practice.aggregate([
      {
        $match: {
          studentId: new require('mongoose').Types.ObjectId(studentId),
          date: { $gte: startDate, $lte: now },
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          totalPractices: { $sum: 1 },
          averageAccuracy: { $avg: '$accuracy' },
          averageScore: { $avg: '$score' },
          totalTimeSpent: { $sum: '$timeSpent' }
        }
      },
      { $sort: { totalPractices: -1 } }
    ]);

    // Get daily activity for the period
    const dailyActivity = await Practice.aggregate([
      {
        $match: {
          studentId: new require('mongoose').Types.ObjectId(studentId),
          date: { $gte: startDate, $lte: now },
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' }
          },
          practices: { $sum: 1 },
          totalTime: { $sum: '$timeSpent' },
          averageAccuracy: { $avg: '$accuracy' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      period,
      dateRange: { start: startDate, end: now },
      stats,
      categoryStats,
      dailyActivity
    });
  } catch (error) {
    console.error('Get practice stats error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get practice analytics for teacher
const getStudentPracticeAnalytics = async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { period = 'month' } = req.query;
    const teacherId = req.user._id;

    // Verify teacher access to class
    const classData = await Class.findById(classId);
    if (!classData || !classData.teacherId.equals(teacherId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Verify student is in the class
    if (!classData.students.includes(studentId)) {
      return res.status(400).json({
        message: 'Student is not enrolled in this class'
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get student info
    const student = await User.findById(studentId).select('name email');

    // Get practice statistics
    const practiceStats = await Practice.getStudentStats(studentId, {
      start: startDate,
      end: now
    });

    // Get detailed practice history
    const practiceHistory = await Practice.find({
      studentId,
      classId,
      date: { $gte: startDate, $lte: now },
      isActive: true
    })
      .populate('assignmentId', 'title')
      .sort({ date: -1 });

    // Get performance trends
    const performanceTrends = await Practice.aggregate([
      {
        $match: {
          studentId: new require('mongoose').Types.ObjectId(studentId),
          classId: new require('mongoose').Types.ObjectId(classId),
          date: { $gte: startDate, $lte: now },
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            week: { $week: '$date' },
            year: { $year: '$date' }
          },
          averageAccuracy: { $avg: '$accuracy' },
          averageScore: { $avg: '$score' },
          totalPractices: { $sum: 1 },
          totalTime: { $sum: '$timeSpent' }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ]);

    res.json({
      student,
      classId,
      period,
      dateRange: { start: startDate, end: now },
      practiceStats,
      practiceHistory,
      performanceTrends
    });
  } catch (error) {
    console.error('Get student practice analytics error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Update practice session
const updatePractice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { practiceId } = req.params;
    const updateData = req.body;
    const studentId = req.user._id;

    const practice = await Practice.findById(practiceId);
    if (!practice) {
      return res.status(404).json({
        message: 'Practice session not found'
      });
    }

    // Verify ownership
    if (!practice.studentId.equals(studentId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Update practice
    const updatedPractice = await Practice.findByIdAndUpdate(
      practiceId,
      updateData,
      { new: true, runValidators: true }
    ).populate('studentId', 'name email')
     .populate('classId', 'name subject')
     .populate('assignmentId', 'title');

    res.json({
      message: 'Practice session updated successfully',
      practice: updatedPractice
    });
  } catch (error) {
    console.error('Update practice error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Delete practice session
const deletePractice = async (req, res) => {
  try {
    const { practiceId } = req.params;
    const studentId = req.user._id;

    const practice = await Practice.findById(practiceId);
    if (!practice) {
      return res.status(404).json({
        message: 'Practice session not found'
      });
    }

    // Verify ownership
    if (!practice.studentId.equals(studentId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Soft delete
    practice.isActive = false;
    await practice.save();

    res.json({
      message: 'Practice session deleted successfully'
    });
  } catch (error) {
    console.error('Delete practice error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

module.exports = {
  savePractice,
  getPracticeHistory,
  getPracticeStats,
  getStudentPracticeAnalytics,
  updatePractice,
  deletePractice
};
