const SystemSettings = require('../models/SystemSettings');
const AppError = require('../utils/AppError');

const DEFAULT_SETTINGS = Object.freeze({
  officeStart: '09:30',
  officeEnd: '18:30',
  assumedBreakMinutes: 60,
  halfDayThresholdMinutes: 240,
});

const timeToMinutes = (time) => {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60) + minutes;
};

const formatSettings = (settings) => {
  const officeStartMinutes = timeToMinutes(settings.officeStart);
  const officeEndMinutes = timeToMinutes(settings.officeEnd);
  return {
    officeStart: settings.officeStart,
    officeEnd: settings.officeEnd,
    expectedWorkingMinutes: officeEndMinutes - officeStartMinutes - settings.assumedBreakMinutes,
    assumedBreakMinutes: settings.assumedBreakMinutes,
    halfDayThresholdMinutes: settings.halfDayThresholdMinutes,
  };
};

const getSystemSettings = async () => {
  const settings = await SystemSettings.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default', ...DEFAULT_SETTINGS } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return formatSettings(settings);
};

const updateSystemSettings = async ({ officeStart, officeEnd }) => {
  const startMinutes = timeToMinutes(officeStart);
  const endMinutes = timeToMinutes(officeEnd);
  if (startMinutes === null || endMinutes === null) throw new AppError(400, 'Office start and end must use HH:MM time format');
  if (endMinutes <= startMinutes) throw new AppError(400, 'Office end must be later than office start');

  const current = await SystemSettings.findOne({ key: 'default' }).lean();
  const assumedBreakMinutes = current ? current.assumedBreakMinutes : DEFAULT_SETTINGS.assumedBreakMinutes;
  if ((endMinutes - startMinutes - assumedBreakMinutes) <= 0) {
    throw new AppError(400, 'Office hours must exceed the configured break time');
  }

  const settings = await SystemSettings.findOneAndUpdate(
    { key: 'default' },
    {
      $set: { officeStart, officeEnd },
      $setOnInsert: {
        key: 'default',
        assumedBreakMinutes: DEFAULT_SETTINGS.assumedBreakMinutes,
        halfDayThresholdMinutes: DEFAULT_SETTINGS.halfDayThresholdMinutes,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  return formatSettings(settings);
};

module.exports = { DEFAULT_SETTINGS, getSystemSettings, updateSystemSettings, timeToMinutes };
