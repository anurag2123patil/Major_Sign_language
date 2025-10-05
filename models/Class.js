const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true,
    maxlength: [100, 'Class name cannot exceed 100 characters']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [50, 'Subject cannot exceed 50 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher ID is required']
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  classCode: {
    type: String,
    unique: true,
    uppercase: true,
    length: [6, 'Class code must be exactly 6 characters']
  },
  videos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  }],
  assignments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  maxStudents: {
    type: Number,
    default: 30
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
classSchema.index({ teacherId: 1 });
classSchema.index({ classCode: 1 });
classSchema.index({ students: 1 });

// Generate unique class code before saving
classSchema.pre('save', async function(next) {
  if (this.isNew && !this.classCode) {
    let classCode;
    let isUnique = false;
    
    while (!isUnique) {
      // Generate a 6-character alphanumeric code
      classCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingClass = await this.constructor.findOne({ classCode });
      isUnique = !existingClass;
    }
    
    this.classCode = classCode;
  }
  next();
});

// Update timestamp on save
classSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for student count
classSchema.virtual('studentCount').get(function() {
  return this.students.length;
});

// Method to add student to class
classSchema.methods.addStudent = function(studentId) {
  if (!this.students.includes(studentId)) {
    this.students.push(studentId);
  }
  return this.save();
};

// Method to remove student from class
classSchema.methods.removeStudent = function(studentId) {
  this.students = this.students.filter(id => !id.equals(studentId));
  return this.save();
};

module.exports = mongoose.model('Class', classSchema);
