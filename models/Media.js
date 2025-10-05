const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  filePath: {
    type: String,
    required: [true, 'File path is required']
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required']
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required']
  },
  type: {
    type: String,
    enum: ['video', 'image', 'audio', 'document'],
    default: 'video'
  },
  category: {
    type: String,
    enum: ['alphabet', 'number', 'word', 'sentence', 'math', 'science', 'general'],
    default: 'general'
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader ID is required']
  },
  views: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number, // in seconds for videos
    default: 0
  },
  thumbnail: {
    type: String // path to thumbnail image
  },
  isActive: {
    type: Boolean,
    default: true
  },
  uploadedAt: {
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
mediaSchema.index({ classId: 1 });
mediaSchema.index({ uploadedBy: 1 });
mediaSchema.index({ type: 1 });
mediaSchema.index({ category: 1 });
mediaSchema.index({ 'views.studentId': 1 });

// Update timestamp on save
mediaSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for view count
mediaSchema.virtual('viewCount').get(function() {
  return this.views.length;
});

// Virtual for unique viewers
mediaSchema.virtual('uniqueViewers').get(function() {
  const uniqueStudentIds = new Set(this.views.map(view => view.studentId.toString()));
  return uniqueStudentIds.size;
});

// Method to add view
mediaSchema.methods.addView = function(studentId, percentage = 0) {
  const existingViewIndex = this.views.findIndex(
    view => view.studentId.toString() === studentId.toString()
  );
  
  if (existingViewIndex >= 0) {
    // Update existing view
    this.views[existingViewIndex].percentage = Math.max(
      this.views[existingViewIndex].percentage, 
      percentage
    );
    this.views[existingViewIndex].date = new Date();
  } else {
    // Add new view
    this.views.push({
      studentId,
      percentage,
      date: new Date()
    });
  }
  
  return this.save();
};

// Method to get average watch percentage
mediaSchema.methods.getAverageWatchPercentage = function() {
  if (this.views.length === 0) return 0;
  
  const totalPercentage = this.views.reduce((sum, view) => sum + view.percentage, 0);
  return Math.round(totalPercentage / this.views.length);
};

module.exports = mongoose.model('Media', mediaSchema);
