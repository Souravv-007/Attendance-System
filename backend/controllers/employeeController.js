const getEmployees = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Employee list endpoint planned for future implementation',
    data: [],
  });
};

const getEmployeeById = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Employee details endpoint planned for future implementation',
    data: {},
  });
};

module.exports = {
  getEmployees,
  getEmployeeById,
};
