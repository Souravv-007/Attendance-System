const test = require('node:test');
const assert = require('node:assert/strict');
const { registerUser, loginUser } = require('../controllers/authController');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const makeRes = () => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  return res;
};

test('registerUser creates a user and returns a token', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalAuditCreate = AuditLog.create;

  User.findOne = async () => null;
  User.create = async (data) => ({
    _id: 'user-1',
    name: data.name,
    email: data.email,
    role: data.role,
    department: data.department || null,
    password: data.password,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  AuditLog.create = async () => ({});

  try {
    const req = {
      body: {
        name: 'Alice Smith',
        employeeId: 'EMP-TEST-001',
        email: 'alice@example.com',
        password: 'Password123',
        role: 'EMPLOYEE',
      },
    };
    const res = makeRes();

    await registerUser(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.user.email, 'alice@example.com');
    assert.ok(res.payload.token);
    assert.notEqual(res.payload.user.password, 'Password123');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    AuditLog.create = originalAuditCreate;
  }
});

test('loginUser accepts valid credentials and returns a token', async () => {
  const originalFindOne = User.findOne;
  const originalAuditCreate = AuditLog.create;
  AuditLog.create = async () => ({});

  User.findOne = async () => ({
    _id: 'user-1',
    name: 'Alice Smith',
    email: 'alice@example.com',
    password: '$2a$10$WvQ3mQ5Hsk9WQ5n6hI0Se.OXU.v4wD9XQhE7mD0f2Y5m0Q/8G7cV6',
    role: 'EMPLOYEE',
    isActive: true,
    comparePassword: async function (candidate) {
      return candidate === 'Password123';
    },
  });

  try {
    const req = {
      body: {
        email: 'alice@example.com',
        password: 'Password123',
      },
    };
    const res = makeRes();

    await loginUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.user.email, 'alice@example.com');
    assert.ok(res.payload.token);
  } finally {
    User.findOne = originalFindOne;
    AuditLog.create = originalAuditCreate;
  }
});
