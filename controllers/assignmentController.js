const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Create assignment (teacher only)
const createAssignment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      title, 
      description, 
      instructions, 
      questions, 
      dueDate, 
      classId,
      allowLateSubmission,
      latePenalty 
    } = req.body;
    
    const createdBy = req.user._id;

    // Verify class exists and user is teacher
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        message: 'Class not found'
      });
    }

    if (!classData.teacherId.equals(createdBy)) {
      return res.status(403).json({
        message: 'Access denied. Only class teacher can create assignments.'
      });
    }

    // Validate questions
    if (!questions || questions.length === 0) {
      return res.status(400).json({
        message: 'At least one question is required'
      });
    }

    // Process questions with order
    const processedQuestions = questions.map((q, index) => ({
      ...q,
      order: index + 1,
      points: q.points || 1
    }));

    // Create assignment
    const assignment = new Assignment({
      title,
      description,
      instructions,
      questions: processedQuestions,
      dueDate,
      classId,
      createdBy,
      allowLateSubmission: allowLateSubmission || false,
      latePenalty: latePenalty || 0
    });

    await assignment.save();

    // Add assignment to class
    await Class.findByIdAndUpdate(classId, {
      $addToSet: { assignments: assignment._id }
    });

    // Populate related fields
    await assignment.populate('createdBy', 'name email');
    await assignment.populate('classId', 'name subject');

    res.status(201).json({
      message: 'Assignment created successfully',
      assignment
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get assignments for a class
const getClassAssignments = async (req, res) => {
  try {
    const { classId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    // Verify class access
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        message: 'Class not found'
      });
    }

    // Check access permissions
    const isTeacher = classData.teacherId.equals(userId);
    const isStudent = req.user.role === 'student' && classData.students.includes(userId);

    if (!isTeacher && !isStudent) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Build query
    const query = { classId, isActive: true };
    
    // Add status filter for students
    if (req.user.role === 'student' && status) {
      if (status === 'submitted') {
        query['submissions.studentId'] = userId;
      } else if (status === 'pending') {
        query['submissions.studentId'] = { $ne: userId };
      }
    }

    // Get paginated results
    const skip = (page - 1) * limit;
    const assignments = await Assignment.find(query)
      .populate('createdBy', 'name email')
      .populate('classId', 'name subject')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // For students, add submission status
    if (req.user.role === 'student') {
      assignments.forEach(assignment => {
        const submission = assignment.submissions.find(
          sub => sub.studentId.equals(userId)
        );
        assignment.submissionStatus = submission ? 'submitted' : 'pending';
        if (submission) {
          assignment.mySubmission = submission;
        }
      });
    }

    const total = await Assignment.countDocuments(query);

    res.json({
      assignments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get class assignments error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get assignment by ID
const getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user._id;

    const assignment = await Assignment.findById(assignmentId)
      .populate('createdBy', 'name email')
      .populate('classId', 'name subject');

    if (!assignment) {
      return res.status(404).json({
        message: 'Assignment not found'
      });
    }

    // Verify access permissions
    const classData = assignment.classId;
    const isTeacher = classData.teacherId.equals(userId);
    const isStudent = req.user.role === 'student' && classData.students.includes(userId);

    if (!isTeacher && !isStudent) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // For students, add their submission status
    if (req.user.role === 'student') {
      const submission = assignment.submissions.find(
        sub => sub.studentId.equals(userId)
      );
      assignment.submissionStatus = submission ? 'submitted' : 'pending';
      if (submission) {
        assignment.mySubmission = submission;
      }
    }

    res.json({
      assignment
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Submit assignment (student only)
const submitAssignment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { assignmentId } = req.params;
    const { answers } = req.body;
    const studentId = req.user._id;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        message: 'Assignment not found'
      });
    }

    // Verify student has access
    const classData = await Class.findById(assignment.classId);
    if (!classData.students.includes(studentId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Check if due date has passed
    const now = new Date();
    if (now > assignment.dueDate && !assignment.allowLateSubmission) {
      return res.status(400).json({
        message: 'Assignment submission deadline has passed'
      });
    }

    // Validate answers
    if (!answers || answers.length === 0) {
      return res.status(400).json({
        message: 'At least one answer is required'
      });
    }

    // Submit assignment
    await assignment.submitAssignment(studentId, answers);

    await assignment.populate('createdBy', 'name email');
    await assignment.populate('classId', 'name subject');

    res.json({
      message: 'Assignment submitted successfully',
      assignment
    });
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Grade assignment (teacher only)
const gradeAssignment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { assignmentId, studentId } = req.params;
    const { score, feedback } = req.body;
    const gradedBy = req.user._id;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        message: 'Assignment not found'
      });
    }

    // Verify teacher access
    const classData = await Class.findById(assignment.classId);
    if (!classData.teacherId.equals(gradedBy)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Grade assignment
    await assignment.gradeAssignment(studentId, score, feedback, gradedBy);

    await assignment.populate('createdBy', 'name email');
    await assignment.populate('classId', 'name subject');

    res.json({
      message: 'Assignment graded successfully',
      assignment
    });
  } catch (error) {
    console.error('Grade assignment error:', error);
    if (error.message === 'Submission not found') {
      return res.status(404).json({
        message: 'Student submission not found'
      });
    }
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Update assignment (teacher only)
const updateAssignment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { assignmentId } = req.params;
    const { 
      title, 
      description, 
      instructions, 
      questions, 
      dueDate,
      allowLateSubmission,
      latePenalty,
      isPublished 
    } = req.body;
    const userId = req.user._id;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        message: 'Assignment not found'
      });
    }

    // Verify teacher access
    const classData = await Class.findById(assignment.classId);
    if (!classData.teacherId.equals(userId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Update assignment
    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (dueDate) updateData.dueDate = dueDate;
    if (allowLateSubmission !== undefined) updateData.allowLateSubmission = allowLateSubmission;
    if (latePenalty !== undefined) updateData.latePenalty = latePenalty;
    if (isPublished !== undefined) updateData.isPublished = isPublished;

    // Update questions if provided
    if (questions && questions.length > 0) {
      const processedQuestions = questions.map((q, index) => ({
        ...q,
        order: index + 1,
        points: q.points || 1
      }));
      updateData.questions = processedQuestions;
    }

    const updatedAssignment = await Assignment.findByIdAndUpdate(
      assignmentId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('classId', 'name subject');

    res.json({
      message: 'Assignment updated successfully',
      assignment: updatedAssignment
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Delete assignment (teacher only)
const deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user._id;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        message: 'Assignment not found'
      });
    }

    // Verify teacher access
    const classData = await Class.findById(assignment.classId);
    if (!classData.teacherId.equals(userId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Remove assignment from class
    await Class.findByIdAndUpdate(assignment.classId, {
      $pull: { assignments: assignmentId }
    });

    // Delete assignment
    await Assignment.findByIdAndDelete(assignmentId);

    res.json({
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get assignment submissions (teacher only)
const getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user._id;

    const assignment = await Assignment.findById(assignmentId)
      .populate('submissions.studentId', 'name email')
      .populate('submissions.gradedBy', 'name email');

    if (!assignment) {
      return res.status(404).json({
        message: 'Assignment not found'
      });
    }

    // Verify teacher access
    const classData = await Class.findById(assignment.classId);
    if (!classData.teacherId.equals(userId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    res.json({
      assignment,
      submissions: assignment.submissions
    });
  } catch (error) {
    console.error('Get assignment submissions error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createAssignment,
  getClassAssignments,
  getAssignmentById,
  submitAssignment,
  gradeAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentSubmissions
};
