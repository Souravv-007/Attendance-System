require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});

app.use(limiter);

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Employee Attendance API is running',
  });
});

app.get('/health', async (req, res) => {
  const mongoStatus = mongooseConnectionStatus();

  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    data: {
      server: 'running',
      mongoDB: mongoStatus,
      timestamp: new Date().toISOString(),
    },
  });
});

function mongooseConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return states[require('mongoose').connection.readyState] || 'unknown';
}

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
