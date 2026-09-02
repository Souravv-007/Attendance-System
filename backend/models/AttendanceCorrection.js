const mongoose = require('mongoose');

const attendanceCorrectionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
    },
    requestedCheckIn: {
      type: Date,
      default: null,
    },
    requestedCheckOut: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewComment: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

attendanceCorrectionSchema.index({ attendance: 1, status: 1 });
attendanceCorrectionSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);
