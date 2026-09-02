const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  officeStart: { type: String, required: true, default: '09:30' },
  officeEnd: { type: String, required: true, default: '18:30' },
  assumedBreakMinutes: { type: Number, required: true, default: 60, min: 0, max: 480 },
  halfDayThresholdMinutes: { type: Number, required: true, default: 240, min: 1 },
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
