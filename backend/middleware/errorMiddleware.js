const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Resource not found',
    error: error.message,
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong',
  });
};

module.exports = {
  notFound,
  errorHandler,
};
