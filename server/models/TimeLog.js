const mongoose = require('mongoose');

const timeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    default: null,
  },
  durationMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  hourlyRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  isBilled: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

timeLogSchema.index({ userId: 1, projectId: 1 });
timeLogSchema.index({ userId: 1, isBilled: 1 });
timeLogSchema.index({ userId: 1, startTime: 1 });

module.exports = mongoose.model('TimeLog', timeLogSchema);
