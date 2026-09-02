const HALF_DAY_THRESHOLD_MINUTES = 240;
const OFFICE_START_HOUR = 9;
const OFFICE_START_MINUTE = 30;

const calculateAttendanceStatus = ({ checkIn, workingMinutes = 0, isWeekend = false, isHoliday = false, hasApprovedLeave = false }) => {
  if (hasApprovedLeave) return 'ON_LEAVE';
  if (isWeekend || isHoliday) return 'ABSENT';
  if (!checkIn) return 'ABSENT';

  const checkInDate = new Date(checkIn);
  const officeStart = new Date(checkInDate);
  officeStart.setUTCHours(OFFICE_START_HOUR, OFFICE_START_MINUTE, 0, 0);
  if (workingMinutes > 0 && workingMinutes < HALF_DAY_THRESHOLD_MINUTES) return 'HALF_DAY';
  if (checkInDate > officeStart) return 'LATE';
  return 'PRESENT';
};

const calculateLateMinutes = (checkIn, workingDate) => {
  const officeStart = new Date(workingDate);
  officeStart.setUTCHours(OFFICE_START_HOUR, OFFICE_START_MINUTE, 0, 0);
  return Math.max(Math.floor((new Date(checkIn) - officeStart) / 60000), 0);
};

const isWeekendDate = (date) => [0, 6].includes(new Date(date).getUTCDay());

const formatDuration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

module.exports = {
  HALF_DAY_THRESHOLD_MINUTES,
  calculateAttendanceStatus,
  calculateLateMinutes,
  formatDuration,
  isWeekendDate,
};