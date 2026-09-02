const HALF_DAY_THRESHOLD_MINUTES = 240;
const OFFICE_START_HOUR = 9;
const OFFICE_START_MINUTE = 30;

const getOfficeStart = (date, officeStart = '09:30') => {
  const [hours, minutes] = officeStart.split(':').map(Number);
  const result = new Date(date);
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
};

const calculateAttendanceStatus = ({ checkIn, workingMinutes = 0, isWeekend = false, isHoliday = false, hasApprovedLeave = false, officeStart = '09:30', halfDayThresholdMinutes = HALF_DAY_THRESHOLD_MINUTES }) => {
  if (hasApprovedLeave) return 'ON_LEAVE';
  if (isWeekend || isHoliday) return 'ABSENT';
  if (!checkIn) return 'ABSENT';

  const checkInDate = new Date(checkIn);
  const startTime = getOfficeStart(checkInDate, officeStart);
  if (workingMinutes > 0 && workingMinutes < halfDayThresholdMinutes) return 'HALF_DAY';
  if (checkInDate > startTime) return 'LATE';
  return 'PRESENT';
};

const calculateLateMinutes = (checkIn, workingDate, officeStart = '09:30') => {
  return Math.max(Math.floor((new Date(checkIn) - getOfficeStart(workingDate, officeStart)) / 60000), 0);
};

const isWeekendDate = (date) => [0, 6].includes(new Date(date).getUTCDay());

const formatDuration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

module.exports = {
  HALF_DAY_THRESHOLD_MINUTES,
  OFFICE_START_HOUR,
  OFFICE_START_MINUTE,
  calculateAttendanceStatus,
  calculateLateMinutes,
  formatDuration,
  isWeekendDate,
};
