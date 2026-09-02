const EXPECTED_WORKING_MINUTES = 480;

const calculateWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const diffMs = new Date(checkOut) - new Date(checkIn);
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.max(diffHours - 1, 0);
};

const calculateWorkingMinutes = (checkIn, checkOut) => {
  const workingMinutes = Math.floor((new Date(checkOut) - new Date(checkIn)) / 60000);
  if (!Number.isFinite(workingMinutes) || workingMinutes <= 0) return 0;
  return workingMinutes;
};

const calculateOvertimeMinutes = (workingMinutes) => Math.max(workingMinutes - EXPECTED_WORKING_MINUTES, 0);
const isCheckoutAfterCheckIn = (checkIn, checkOut) => new Date(checkOut) > new Date(checkIn);

module.exports = {
  EXPECTED_WORKING_MINUTES,
  calculateWorkingHours,
  calculateWorkingMinutes,
  calculateOvertimeMinutes,
  isCheckoutAfterCheckIn,
};
