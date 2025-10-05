const mongoose = require('mongoose');

const practiceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  type: {
    type: String,
    enum: ['writing', 'typing', 'drawing'],
    required: [true, 'Practice type is required']
  },
  category: {
    type: String,
    enum: ['alphabet', 'number', 'word', 'sentence', 'math', 'science', 'general'],
    required: [true, 'Category is required']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    maxlength: [2000, 'Content cannot exceed 2000 characters']
  },
  targetContent: {
    type: String,
    maxlength: [2000, 'Target content cannot exceed 2000 characters']
  },
  accuracy: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  strokes: {
    type: Number,
    default: 0,
    min: 0
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0,
    min: 0
  },
  attempts: {
    type: Number,
    default: 1,
    min: 1
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  // For writing practice
  writingData: {
    strokes: [{
      x: Number,
      y: Number,
      timestamp: Number,
      pressure: Number
    }],
    canvasWidth: Number,
    canvasHeight: Number
  },
  // For typing practice
  typingData: {
    charactersPerMinute: Number,
    wordsPerMinute: Number,
    errorCount: Number,
    backspaceCount: Number,
    keystrokeData: [{
      key: String,
      timestamp: Number,
      isCorrect: Boolean
    }]
  },
  // Scoring and evaluation
  score: {
    type: Number,
    default: 0,
    min: 0
  },
  maxScore: {
    type: Number,
    default: 100
  },
  feedback: {
    type: String,
    maxlength: [500, 'Feedback cannot exceed 500 characters']
  },
  // Progress tracking
  isCompleted: {
    type: Boolean,
    default: false
  },
  completionTime: {
    type: Number // in seconds
  },
  // Class and assignment context
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment'
  },
  // Metadata
  deviceInfo: {
    platform: String,
    screenSize: String,
    inputMethod: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
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
practiceSchema.index({ studentId: 1 });
practiceSchema.index({ type: 1 });
practiceSchema.index({ category: 1 });
practiceSchema.index({ date: 1 });
practiceSchema.index({ classId: 1 });
practiceSchema.index({ assignmentId: 1 });

// Update timestamp on save
practiceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for performance rating
practiceSchema.virtual('performanceRating').get(function() {
  if (this.accuracy >= 90) return 'excellent';
  if (this.accuracy >= 75) return 'good';
  if (this.accuracy >= 60) return 'fair';
  return 'needs_improvement';
});

// Method to calculate typing metrics
practiceSchema.methods.calculateTypingMetrics = function() {
  if (this.type !== 'typing' || !this.typingData.keystrokeData) return;
  
  const keystrokes = this.typingData.keystrokeData;
  const totalTime = this.timeSpent / 60; // in minutes
  const correctKeystrokes = keystrokes.filter(k => k.isCorrect).length;
  
  this.typingData.charactersPerMinute = totalTime > 0 ? Math.round(correctKeystrokes / totalTime) : 0;
  this.typingData.wordsPerMinute = totalTime > 0 ? Math.round(this.typingData.charactersPerMinute / 5) : 0;
  this.typingData.errorCount = keystrokes.length - correctKeystrokes;
};

// Method to evaluate writing practice
practiceSchema.methods.evaluateWriting = function() {
  if (this.type !== 'writing' || !this.targetContent) return;
  
  // Simple evaluation based on content similarity
  // This can be enhanced with more sophisticated handwriting recognition
  const similarity = this.calculateContentSimilarity(this.content, this.targetContent);
  this.accuracy = Math.round(similarity * 100);
  this.score = Math.round((this.accuracy / 100) * this.maxScore);
};

// Helper method to calculate content similarity
practiceSchema.methods.calculateContentSimilarity = function(content1, content2) {
  if (!content1 || !content2) return 0;
  
  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const norm1 = normalize(content1);
  const norm2 = normalize(content2);
  
  if (norm1 === norm2) return 1;
  
  // Simple character-based similarity
  const len1 = norm1.length;
  const len2 = norm2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return 1;
  
  let matches = 0;
  const minLen = Math.min(len1, len2);
  
  for (let i = 0; i < minLen; i++) {
    if (norm1[i] === norm2[i]) matches++;
  }
  
  return matches / maxLen;
};

// Static method to get practice statistics for a student
practiceSchema.statics.getStudentStats = async function(studentId, dateRange = {}) {
  const matchQuery = { studentId: new mongoose.Types.ObjectId(studentId) };
  
  if (dateRange.start && dateRange.end) {
    matchQuery.date = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$type',
        totalPractices: { $sum: 1 },
        averageAccuracy: { $avg: '$accuracy' },
        averageScore: { $avg: '$score' },
        totalTimeSpent: { $sum: '$timeSpent' },
        completedPractices: {
          $sum: { $cond: ['$isCompleted', 1, 0] }
        }
      }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('Practice', practiceSchema);
