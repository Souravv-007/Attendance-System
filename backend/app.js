require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { requestLogger } = require('./middleware/requestLogger');

const app = express();

app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    const configuredOrigins = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(helmet());
app.use(requestLogger);
app.use('/api', routes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Employee Attendance API is running',
    data: {},
  });
});

app.get('/health', (req, res) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    data: {
      server: 'running',
      mongoDB: states[require('mongoose').connection.readyState] || 'unknown',
      timestamp: new Date().toISOString(),
    },
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
