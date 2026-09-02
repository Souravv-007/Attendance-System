const nodemailer = require('nodemailer');

const smtpIsConfigured = () => ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM']
  .every((key) => Boolean(process.env[key]));

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  if (process.env.NODE_ENV === 'development') {
    return { delivered: false, developmentResetUrl: resetUrl };
  }

  if (!smtpIsConfigured()) return { delivered: false };

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Reset your Employee Attendance Management System password',
    text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in one hour.`,
  });
  return { delivered: true };
};

module.exports = { sendPasswordResetEmail };
