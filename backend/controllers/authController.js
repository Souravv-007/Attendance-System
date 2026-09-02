const registerUser = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Register endpoint planned for future implementation',
    data: {},
  });
};

const loginUser = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Login endpoint planned for future implementation',
    data: {},
  });
};

module.exports = {
  registerUser,
  loginUser,
};
