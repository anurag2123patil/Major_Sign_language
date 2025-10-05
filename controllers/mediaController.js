const Media = require('../models/Media');
const Class = require('../models/Class');
const { validationResult } = require('express-validator');
const { getFileInfo, deleteFile } = require('../middleware/upload');

// Upload media file
const uploadMedia = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded'
      });
    }

    const { title, description, category, tags, classId } = req.body;
    const uploadedBy = req.user._id;

    // Verify class exists and user has access
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        message: 'Class not found'
      });
    }

    // Check if user is teacher of this class
    if (!classData.teacherId.equals(uploadedBy)) {
      return res.status(403).json({
        message: 'Access denied. Only class teacher can upload media.'
      });
    }

    // Get file information
    const fileInfo = getFileInfo(req.file);

    // Determine media type based on MIME type
    let type = 'video';
    if (fileInfo.mimetype.startsWith('image/')) {
      type = 'image';
    } else if (fileInfo.mimetype.startsWith('audio/')) {
      type = 'audio';
    } else {
      type = 'document';
    }

    // Create media record
    const media = new Media({
      title,
      description,
      filePath: fileInfo.path,
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimetype,
      fileSize: fileInfo.size,
      type,
      category: category || 'general',
      classId,
      uploadedBy,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    await media.save();

    // Add media to class
    await Class.findByIdAndUpdate(classId, {
      $addToSet: { videos: media._id }
    });

    // Populate related fields
    await media.populate('uploadedBy', 'name email');
    await media.populate('classId', 'name subject');

    res.status(201).json({
      message: 'Media uploaded successfully',
      media
    });
  } catch (error) {
    console.error('Upload media error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      await deleteFile(req.file.path);
    }
    
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get media for a class
const getClassMedia = async (req, res) => {
  try {
    const { classId } = req.params;
    const { type, category, page = 1, limit = 10 } = req.query;

    // Verify class access
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        message: 'Class not found'
      });
    }

    // Check access permissions
    const isTeacher = classData.teacherId.equals(req.user._id);
    const isStudent = req.user.role === 'student' && classData.students.includes(req.user._id);

    if (!isTeacher && !isStudent) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Build query
    const query = { classId, isActive: true };
    if (type) query.type = type;
    if (category) query.category = category;

    // Get paginated results
    const skip = (page - 1) * limit;
    const media = await Media.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Media.countDocuments(query);

    res.json({
      media,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get class media error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get media by ID
const getMediaById = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const media = await Media.findById(mediaId)
      .populate('uploadedBy', 'name email')
      .populate('classId', 'name subject');

    if (!media) {
      return res.status(404).json({
        message: 'Media not found'
      });
    }

    // Verify access permissions
    const classData = media.classId;
    const isTeacher = classData.teacherId.equals(req.user._id);
    const isStudent = req.user.role === 'student' && classData.students.includes(req.user._id);

    if (!isTeacher && !isStudent) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    res.json({
      media
    });
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Record media view (for tracking progress)
const recordView = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { mediaId } = req.params;
    const { percentage } = req.body;
    const studentId = req.user._id;

    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({
        message: 'Media not found'
      });
    }

    // Verify student has access to this media
    const classData = await Class.findById(media.classId);
    if (!classData.students.includes(studentId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Add or update view
    await media.addView(studentId, percentage);

    res.json({
      message: 'View recorded successfully'
    });
  } catch (error) {
    console.error('Record view error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Update media details (teacher only)
const updateMedia = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { mediaId } = req.params;
    const { title, description, category, tags, isPublic } = req.body;
    const userId = req.user._id;

    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({
        message: 'Media not found'
      });
    }

    // Check if user is the uploader or class teacher
    const classData = await Class.findById(media.classId);
    const isUploader = media.uploadedBy.equals(userId);
    const isTeacher = classData.teacherId.equals(userId);

    if (!isUploader && !isTeacher) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Update media
    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (tags) updateData.tags = tags.split(',').map(tag => tag.trim());
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const updatedMedia = await Media.findByIdAndUpdate(
      mediaId,
      updateData,
      { new: true, runValidators: true }
    ).populate('uploadedBy', 'name email')
     .populate('classId', 'name subject');

    res.json({
      message: 'Media updated successfully',
      media: updatedMedia
    });
  } catch (error) {
    console.error('Update media error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Delete media (teacher only)
const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = req.user._id;

    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({
        message: 'Media not found'
      });
    }

    // Check if user is the uploader or class teacher
    const classData = await Class.findById(media.classId);
    const isUploader = media.uploadedBy.equals(userId);
    const isTeacher = classData.teacherId.equals(userId);

    if (!isUploader && !isTeacher) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Delete physical file
    await deleteFile(media.filePath);

    // Remove media from class
    await Class.findByIdAndUpdate(media.classId, {
      $pull: { videos: mediaId }
    });

    // Delete media record
    await Media.findByIdAndDelete(mediaId);

    res.json({
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

// Get media analytics (teacher only)
const getMediaAnalytics = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user._id;

    // Verify teacher access
    const classData = await Class.findById(classId);
    if (!classData || !classData.teacherId.equals(userId)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Get media analytics
    const mediaList = await Media.find({ classId })
      .populate('views.studentId', 'name email')
      .sort({ uploadedAt: -1 });

    const analytics = mediaList.map(media => ({
      id: media._id,
      title: media.title,
      type: media.type,
      category: media.category,
      uploadDate: media.uploadedAt,
      totalViews: media.viewCount,
      uniqueViewers: media.uniqueViewers,
      averageWatchPercentage: media.getAverageWatchPercentage(),
      views: media.views
    }));

    res.json({
      analytics
    });
  } catch (error) {
    console.error('Get media analytics error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

module.exports = {
  uploadMedia,
  getClassMedia,
  getMediaById,
  recordView,
  updateMedia,
  deleteMedia,
  getMediaAnalytics
};
