const Class = require('../models/Class');
const User = require('../models/User');
const Media = require('../models/Media');
const Assignment = require('../models/Assignment');
const { validationResult } = require('express-validator');

// Create new class
const createClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, subject, description, maxStudents } = req.body;
    const teacherId = req.user._id;

    // Create class
    const newClass = new Class({
      name,
      subject,
      description,
      teacherId,
      maxStudents: maxStudents || 30
    });

    await newClass.save();

    // Populate teacher info
    await newClass.populate('teacherId', 'name email');

    res.status(201).json({
      message: 'Class created successfully',
      class: newClass
    });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get all classes for a teacher
const getTeacherClasses = async (req, res) => {
  try {
    const teacherId = req.user._id;

    const classes = await Class.find({ teacherId })
      .populate('students', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      classes
    });
  } catch (error) {
    console.error('Get teacher classes error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get all classes for a student
const getStudentClasses = async (req, res) => {
  try {
    const studentId = req.user._id;

    const classes = await Class.find({ students: studentId })
      .populate('teacherId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      classes
    });
  } catch (error) {
    console.error('Get student classes error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get class by ID
const getClassById = async (req, res) => {
  try {
    const { classId } = req.params;

    const classData = await Class.findById(classId)
      .populate('teacherId', 'name email')
      .populate('students', 'name email')
      .populate('videos')
      .populate('assignments');

    if (!classData) {
      return res.status(404).json({
        message: 'Class not found'
      });
    }

    res.json({
      class: classData
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Join class by class code
const joinClassByCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { classCode } = req.body;
    const studentId = req.user._id;

    // Find class by code
    const classData = await Class.findOne({ classCode: classCode.toUpperCase() });
    if (!classData) {
      return res.status(404).json({
        message: 'Invalid class code'
      });
    }

    // Check if class is active
    if (!classData.isActive) {
      return res.status(400).json({
        message: 'This class is no longer active'
      });
    }

    // Check if class is full
    if (classData.students.length >= classData.maxStudents) {
      return res.status(400).json({
        message: 'This class is full'
      });
    }

    // Check if student is already enrolled
    if (classData.students.includes(studentId)) {
      return res.status(400).json({
        message: 'You are already enrolled in this class'
      });
    }

    // Add student to class
    await classData.addStudent(studentId);

    // Add class to student's class list
    await User.findByIdAndUpdate(studentId, {
      $addToSet: { 'studentInfo.classIds': classData._id }
    });

    await classData.populate('teacherId', 'name email');
    await classData.populate('students', 'name email');

    res.json({
      message: 'Successfully joined class',
      class: classData
    });
  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Add student to class (teacher only)
const addStudentToClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { studentEmail } = req.body;
    const { classId } = req.params;

    // Find student by email
    const student = await User.findOne({ 
      email: studentEmail, 
      role: 'student' 
    });
    
    if (!student) {
      return res.status(404).json({
        message: 'Student not found with this email'
      });
    }

    // Check if student is already enrolled
    if (req.classData.students.includes(student._id)) {
      return res.status(400).json({
        message: 'Student is already enrolled in this class'
      });
    }

    // Check if class is full
    if (req.classData.students.length >= req.classData.maxStudents) {
      return res.status(400).json({
        message: 'Class is full'
      });
    }

    // Add student to class
    await req.classData.addStudent(student._id);

    // Add class to student's class list
    await User.findByIdAndUpdate(student._id, {
      $addToSet: { 'studentInfo.classIds': classId }
    });

    await req.classData.populate('students', 'name email');

    res.json({
      message: 'Student added to class successfully',
      class: req.classData
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Remove student from class (teacher only)
const removeStudentFromClass = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if student is enrolled
    if (!req.classData.students.includes(studentId)) {
      return res.status(400).json({
        message: 'Student is not enrolled in this class'
      });
    }

    // Remove student from class
    await req.classData.removeStudent(studentId);

    // Remove class from student's class list
    await User.findByIdAndUpdate(studentId, {
      $pull: { 'studentInfo.classIds': req.classData._id }
    });

    await req.classData.populate('students', 'name email');

    res.json({
      message: 'Student removed from class successfully',
      class: req.classData
    });
  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Update class details (teacher only)
const updateClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, subject, description, maxStudents, isActive } = req.body;
    const { classId } = req.params;

    const updateData = {};
    if (name) updateData.name = name;
    if (subject) updateData.subject = subject;
    if (description !== undefined) updateData.description = description;
    if (maxStudents) updateData.maxStudents = maxStudents;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      updateData,
      { new: true, runValidators: true }
    ).populate('teacherId', 'name email')
     .populate('students', 'name email');

    if (!updatedClass) {
      return res.status(404).json({
        message: 'Class not found'
      });
    }

    res.json({
      message: 'Class updated successfully',
      class: updatedClass
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Delete class (teacher only)
const deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;

    // Remove class from all students
    await User.updateMany(
      { 'studentInfo.classIds': classId },
      { $pull: { 'studentInfo.classIds': classId } }
    );

    // Delete all media files associated with the class
    const mediaFiles = await Media.find({ classId });
    for (const media of mediaFiles) {
      // Delete physical files
      const fs = require('fs');
      const path = require('path');
      try {
        fs.unlinkSync(path.join(__dirname, '..', media.filePath));
      } catch (err) {
        console.log('File not found:', media.filePath);
      }
    }

    // Delete media records
    await Media.deleteMany({ classId });

    // Delete assignments
    await Assignment.deleteMany({ classId });

    // Delete class
    await Class.findByIdAndDelete(classId);

    res.json({
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get class statistics (teacher only)
const getClassStats = async (req, res) => {
  try {
    const { classId } = req.params;

    const stats = await Promise.all([
      // Student count
      Class.findById(classId).select('students').lean(),
      // Media count
      Media.countDocuments({ classId }),
      // Assignment count
      Assignment.countDocuments({ classId }),
      // Recent activity
      Media.find({ classId })
        .sort({ uploadedAt: -1 })
        .limit(5)
        .select('title uploadedAt type'),
      Assignment.find({ classId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title dueDate createdAt')
    ]);

    const [classData, mediaCount, assignmentCount, recentMedia, recentAssignments] = stats;

    res.json({
      stats: {
        studentCount: classData.students.length,
        mediaCount,
        assignmentCount,
        recentMedia,
        recentAssignments
      }
    });
  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

module.exports = {
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
};
