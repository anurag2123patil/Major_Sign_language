const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Assignment title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  instructions: {
    type: String,
    maxlength: [2000, 'Instructions cannot exceed 2000 characters']
  },
  questions: [{
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      maxlength: [1000, 'Question cannot exceed 1000 characters']
    },
    questionType: {
      type: String,
      enum: ['multiple_choice', 'short_answer', 'long_answer', 'true_false'],
      default: 'short_answer'
    },
    options: [{
      type: String,
      maxlength: [200, 'Option cannot exceed 200 characters']
    }],
    correctAnswer: {
      type: String,
      maxlength: [500, 'Correct answer cannot exceed 500 characters']
    },
    points: {
      type: Number,
      default: 1,
      min: 1
    },
    order: {
      type: Number,
      required: true
    }
  }],
  totalPoints: {
    type: Number,
    default: 0
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required']
  },
  submissions: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    answers: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      answer: {
        type: String,
        maxlength: [2000, 'Answer cannot exceed 2000 characters']
      },
      isCorrect: {
        type: Boolean,
        default: false
      },
      pointsEarned: {
        type: Number,
        default: 0
      }
    }],
    score: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    feedback: {
      type: String,
      maxlength: [1000, 'Feedback cannot exceed 1000 characters']
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    gradedAt: {
      type: Date
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  allowLateSubmission: {
    type: Boolean,
    default: false
  },
  latePenalty: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
assignmentSchema.index({ classId: 1 });
assignmentSchema.index({ createdBy: 1 });
assignmentSchema.index({ dueDate: 1 });
assignmentSchema.index({ 'submissions.studentId': 1 });
assignmentSchema.index({ isPublished: 1 });

// Calculate total points before saving
assignmentSchema.pre('save', function(next) {
  if (this.isModified('questions')) {
    this.totalPoints = this.questions.reduce((total, question) => total + question.points, 0);
  }
  this.updatedAt = Date.now();
  next();
});

// Virtual for submission count
assignmentSchema.virtual('submissionCount').get(function() {
  return this.submissions.length;
});

// Virtual for average score
assignmentSchema.virtual('averageScore').get(function() {
  if (this.submissions.length === 0) return 0;
  
  const totalScore = this.submissions.reduce((sum, submission) => sum + submission.score, 0);
  return Math.round(totalScore / this.submissions.length);
});

// Method to submit assignment
assignmentSchema.methods.submitAssignment = function(studentId, answers) {
  // Remove existing submission if any
  this.submissions = this.submissions.filter(
    submission => submission.studentId.toString() !== studentId.toString()
  );
  
  // Calculate score
  let score = 0;
  const processedAnswers = answers.map(answer => {
    const question = this.questions.id(answer.questionId);
    let isCorrect = false;
    let pointsEarned = 0;
    
    if (question) {
      // Simple string comparison for now - can be enhanced for different question types
      if (answer.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()) {
        isCorrect = true;
        pointsEarned = question.points;
        score += question.points;
      }
    }
    
    return {
      questionId: answer.questionId,
      answer: answer.answer,
      isCorrect,
      pointsEarned
    };
  });
  
  const percentage = this.totalPoints > 0 ? Math.round((score / this.totalPoints) * 100) : 0;
  
  // Add new submission
  this.submissions.push({
    studentId,
    answers: processedAnswers,
    score,
    percentage,
    submittedAt: new Date()
  });
  
  return this.save();
};

// Method to grade assignment
assignmentSchema.methods.gradeAssignment = function(studentId, score, feedback, gradedBy) {
  const submission = this.submissions.find(
    sub => sub.studentId.toString() === studentId.toString()
  );
  
  if (submission) {
    submission.score = score;
    submission.percentage = this.totalPoints > 0 ? Math.round((score / this.totalPoints) * 100) : 0;
    submission.feedback = feedback;
    submission.gradedAt = new Date();
    submission.gradedBy = gradedBy;
    
    return this.save();
  }
  
  throw new Error('Submission not found');
};

module.exports = mongoose.model('Assignment', assignmentSchema);
