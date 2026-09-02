require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

const TEST_EMAIL = 'test.hr@local.dev';
const TEST_NAME = 'Development HR Test Account';

const validateEnvironment = () => {
  if (process.env.NODE_ENV !== 'development') throw new Error('This script runs only when NODE_ENV=development.');
  if (!process.argv.includes('--confirm-local-development')) throw new Error('Pass --confirm-local-development to acknowledge the target database.');
  if (!process.env.HR_TEST_DB_NAME) throw new Error('Set HR_TEST_DB_NAME to the expected development database name.');
  if (!process.env.HR_TEST_PASSWORD || process.env.HR_TEST_PASSWORD.length < 12) throw new Error('Set HR_TEST_PASSWORD to a password of at least 12 characters.');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');
};

const createOrResetHrTestUser = async () => {
  validateEnvironment();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  if (mongoose.connection.name !== process.env.HR_TEST_DB_NAME) {
    throw new Error('Connected database does not match HR_TEST_DB_NAME; no account was changed.');
  }

  const existing = await User.findOne({ email: TEST_EMAIL });
  if (existing && existing.role !== 'HR') {
    throw new Error(`${TEST_EMAIL} already belongs to a non-HR account; no account was changed.`);
  }

  const password = await bcrypt.hash(process.env.HR_TEST_PASSWORD, 10);
  if (existing) {
    existing.password = password;
    existing.isActive = true;
    await existing.save();
    return 'reset';
  }

  await User.create({ name: TEST_NAME, email: TEST_EMAIL, password, role: 'HR', isActive: true });
  return 'created';
};

if (require.main === module) {
  createOrResetHrTestUser()
    .then((action) => { console.log(`HR test account ${action}: ${TEST_EMAIL} (role HR). Password was not logged.`); })
    .catch((error) => { console.error(`HR test account was not changed: ${error.message}`); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); });
}

module.exports = { TEST_EMAIL, createOrResetHrTestUser, validateEnvironment };
