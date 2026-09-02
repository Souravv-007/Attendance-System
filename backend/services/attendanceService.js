// This service will hold attendance validation and working-hours logic later.
const calculateWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const diffMs = new Date(checkOut) - new Date(checkIn);
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.max(diffHours - 1, 0);
};

module.exports = {
  calculateWorkingHours,
};
