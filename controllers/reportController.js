const User = require('../models/User');
const Class = require('../models/Class');
const Media = require('../models/Media');
const Assignment = require('../models/Assignment');
const Practice = require('../models/Practice');
const { validationResult } = require('express-validator');

// Get student progress report
const getStudentProgressReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { period = 'month' } = req.query;
    const userId = req.user._id;

    // Verify access permissions
    if (req.user.role === 'parent') {
      // Check if user is parent of the student
      const student = await User.findById(studentId);
      if (!student || student.studentInfo?.parentEmail !== req.user.email) {
        return res.status(403).json({
          message: 'Access denied. You can only view your own child\'s progress.'
        });
      }
    } else if (req.user.role === 'student') {
      // Students can only view their own progress
      if (studentId !== userId.toString()) {
        return res.status(403).json({
          message: 'Access denied. You can only view your own progress.'
        });
      }
    } else if (req.user.role === 'teacher') {
      // Teachers need to verify student is in their class
      const classes = await Class.find({ teacherId: userId, students: studentId });
      if (classes.length === 0) {
        return res.status(403).json({
          message: 'Access denied. Student is not in any of your classes.'
        });
      }
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
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get student information
    const student = await User.findById(studentId)
      .populate('studentInfo.classIds', 'name subject')
      .select('-password');

    // Get practice statistics
    const practiceStats = await Practice.getStudentStats(studentId, {
      start: startDate,
      end: now
    });

    // Get assignment performance
    const assignmentPerformance = await Assignment.aggregate([
      {
        $match: {
          'submissions.studentId': new require('mongoose').Types.ObjectId(studentId),
          createdAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $unwind: '$submissions'
      },
      {
        $match: {
          'submissions.studentId': new require('mongoose').Types.ObjectId(studentId)
        }
      },
      {
        $group: {
          _id: '$classId',
          totalAssignments: { $sum: 1 },
          averageScore: { $avg: '$submissions.score' },
          averagePercentage: { $avg: '$submissions.percentage' },
          totalPoints: { $sum: '$totalPoints' },
          earnedPoints: { $sum: '$submissions.score' }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: '_id',
          as: 'class'
        }
      },
      {
        $unwind: '$class'
      },
      {
        $project: {
          className: '$class.name',
          subject: '$class.subject',
          totalAssignments: 1,
          averageScore: 1,
          averagePercentage: 1,
          totalPoints: 1,
          earnedPoints: 1
        }
      }
    ]);

    // Get media consumption
    const mediaConsumption = await Media.aggregate([
      {
        $match: {
          'views.studentId': new require('mongoose').Types.ObjectId(studentId),
          uploadedAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $unwind: '$views'
      },
      {
        $match: {
          'views.studentId': new require('mongoose').Types.ObjectId(studentId)
        }
      },
      {
        $group: {
          _id: '$classId',
          totalVideos: { $sum: 1 },
          averageWatchPercentage: { $avg: '$views.percentage' },
          totalWatchTime: { $sum: '$views.percentage' }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: '_id',
          as: 'class'
        }
      },
      {
        $unwind: '$class'
      },
      {
        $project: {
          className: '$class.name',
          subject: '$class.subject',
          totalVideos: 1,
          averageWatchPercentage: 1,
          totalWatchTime: 1
        }
      }
    ]);

    // Get recent activities
    const recentActivities = await Promise.all([
      // Recent practice sessions
      Practice.find({
        studentId,
        date: { $gte: startDate, $lte: now },
        isActive: true
      })
        .populate('classId', 'name subject')
        .sort({ date: -1 })
        .limit(5),
      
      // Recent assignment submissions
      Assignment.find({
        'submissions.studentId': studentId,
        'submissions.submittedAt': { $gte: startDate, $lte: now }
      })
        .populate('classId', 'name subject')
        .sort({ 'submissions.submittedAt': -1 })
        .limit(5)
    ]);

    // Calculate overall progress score
    const overallScore = calculateOverallProgressScore(
      practiceStats,
      assignmentPerformance,
      mediaConsumption
    );

    res.json({
      student,
      period,
      dateRange: { start: startDate, end: now },
      overallScore,
      practiceStats,
      assignmentPerformance,
      mediaConsumption,
      recentActivities: {
        practices: recentActivities[0],
        assignments: recentActivities[1]
      }
    });
  } catch (error) {
    console.error('Get student progress report error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get class analytics (teacher only)
const getClassAnalytics = async (req, res) => {
  try {
    const { classId } = req.params;
    const { period = 'month' } = req.query;
    const teacherId = req.user._id;

    // Verify teacher access
    const classData = await Class.findById(classId)
      .populate('students', 'name email')
      .populate('teacherId', 'name email');

    if (!classData || !classData.teacherId.equals(teacherId)) {
      return res.status(403).json({
        message: 'Access denied'
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

    // Get class statistics
    const classStats = await Promise.all([
      // Media statistics
      Media.aggregate([
        {
          $match: {
            classId: new require('mongoose').Types.ObjectId(classId),
            uploadedAt: { $gte: startDate, $lte: now }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalViews: { $sum: { $size: '$views' } },
            averageWatchPercentage: { $avg: { $avg: '$views.percentage' } }
          }
        }
      ]),

      // Assignment statistics
      Assignment.aggregate([
        {
          $match: {
            classId: new require('mongoose').Types.ObjectId(classId),
            createdAt: { $gte: startDate, $lte: now }
          }
        },
        {
          $group: {
            _id: null,
            totalAssignments: { $sum: 1 },
            totalSubmissions: { $sum: { $size: '$submissions' } },
            averageScore: { $avg: { $avg: '$submissions.score' } },
            averagePercentage: { $avg: { $avg: '$submissions.percentage' } }
          }
        }
      ]),

      // Student engagement
      Practice.aggregate([
        {
          $match: {
            classId: new require('mongoose').Types.ObjectId(classId),
            date: { $gte: startDate, $lte: now },
            isActive: true
          }
        },
        {
          $group: {
            _id: '$studentId',
            totalPractices: { $sum: 1 },
            averageAccuracy: { $avg: '$accuracy' },
            totalTimeSpent: { $sum: '$timeSpent' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'student'
          }
        },
        {
          $unwind: '$student'
        },
        {
          $project: {
            studentName: '$student.name',
            studentEmail: '$student.email',
            totalPractices: 1,
            averageAccuracy: 1,
            totalTimeSpent: 1
          }
        },
        { $sort: { totalPractices: -1 } }
      ])
    ]);

    // Get top performers
    const topPerformers = classStats[2].slice(0, 5);

    // Get struggling students (low engagement/performance)
    const strugglingStudents = classStats[2]
      .filter(student => student.averageAccuracy < 60 || student.totalPractices < 3)
      .slice(0, 5);

    res.json({
      class: classData,
      period,
      dateRange: { start: startDate, end: now },
      mediaStats: classStats[0],
      assignmentStats: classStats[1][0] || {},
      studentEngagement: classStats[2],
      topPerformers,
      strugglingStudents
    });
  } catch (error) {
    console.error('Get class analytics error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get parent dashboard data
const getParentDashboard = async (req, res) => {
  try {
    const parentId = req.user._id;

    // Get parent's children
    const children = await User.find({
      'studentInfo.parentEmail': req.user.email,
      role: 'student',
      isActive: true
    }).select('-password');

    if (children.length === 0) {
      return res.json({
        children: [],
        message: 'No children found for this parent account'
      });
    }

    // Get progress data for each child
    const childrenProgress = await Promise.all(
      children.map(async (child) => {
        // Get practice stats for the last month
        const practiceStats = await Practice.getStudentStats(child._id, {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        });

        // Get recent assignments
        const recentAssignments = await Assignment.find({
          'submissions.studentId': child._id,
          'submissions.submittedAt': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
          .populate('classId', 'name subject')
          .sort({ 'submissions.submittedAt': -1 })
          .limit(5);

        // Get classes
        const classes = await Class.find({ students: child._id })
          .populate('teacherId', 'name email')
          .select('name subject');

        return {
          child: child.toJSON(),
          practiceStats,
          recentAssignments,
          classes
        };
      })
    );

    res.json({
      children: childrenProgress
    });
  } catch (error) {
    console.error('Get parent dashboard error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Helper function to calculate overall progress score
const calculateOverallProgressScore = (practiceStats, assignmentPerformance, mediaConsumption) => {
  let score = 0;
  let weight = 0;

  // Practice performance (40% weight)
  if (practiceStats.length > 0) {
    const avgAccuracy = practiceStats.reduce((sum, stat) => sum + stat.averageAccuracy, 0) / practiceStats.length;
    score += (avgAccuracy / 100) * 40;
    weight += 40;
  }

  // Assignment performance (40% weight)
  if (assignmentPerformance.length > 0) {
    const avgPercentage = assignmentPerformance.reduce((sum, perf) => sum + perf.averagePercentage, 0) / assignmentPerformance.length;
    score += (avgPercentage / 100) * 40;
    weight += 40;
  }

  // Media consumption (20% weight)
  if (mediaConsumption.length > 0) {
    const avgWatchPercentage = mediaConsumption.reduce((sum, media) => sum + media.averageWatchPercentage, 0) / mediaConsumption.length;
    score += (avgWatchPercentage / 100) * 20;
    weight += 20;
  }

  return weight > 0 ? Math.round(score / weight * 100) : 0;
};

module.exports = {
  getStudentProgressReport,
  getClassAnalytics,
  getParentDashboard
};
