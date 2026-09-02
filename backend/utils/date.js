const getWorkingDate = (date = new Date()) => {
  const workingDate = new Date(date);
  workingDate.setUTCHours(0, 0, 0, 0);
  return workingDate;
};

module.exports = { getWorkingDate };