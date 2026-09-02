const sensitiveKeys = /password|token|secret|credential/i;

const requestLogger = (req, res, next) => {
  const startedAt = Date.now();
  const originalBody = req.body;
  const safeBody = originalBody && typeof originalBody === 'object'
    ? Object.keys(originalBody).reduce((result, key) => {
        if (!sensitiveKeys.test(key)) {
          result[key] = originalBody[key];
        }
        return result;
      }, {})
    : {};

  res.on('finish', () => {
    console.log(JSON.stringify({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      bodyKeys: Object.keys(safeBody),
    }));
  });

  next();
};

module.exports = { requestLogger };
