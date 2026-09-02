# Employee Attendance Management System

## Project Description
This project is a beginner-friendly Employee Attendance Management System built with HTML, CSS, JavaScript, Node.js, Express.js, MongoDB Atlas, and Mongoose. The goal is to manage employee attendance, leave requests, corrections, and role-based access for employees, HR, and admins.

## Features
- Employee registration and login
- Role-based dashboards for employee, HR, and admin
- Attendance tracking with check-in and check-out
- Leave request workflow
- Attendance correction requests
- Basic reporting structure for future development
- Security conventions using environment variables, JWT, bcrypt, Helmet, and rate limiting

## Technology Stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js
- Framework: Express.js
- Database: MongoDB Atlas
- ODM: Mongoose
- Authentication: JWT
- Password hashing: bcryptjs
- Validation: express-validator
- Security: helmet
- CORS: cors
- Rate limiting: express-rate-limit
- Environment variables: dotenv

## User Roles
- Employee
- HR
- Admin

## Attendance Rules
- Office starts at 09:30 AM
- Office ends at 06:30 PM
- Expected workday is 8 hours
- A 1-hour break is assumed for working hours calculations
- Attendance status values include PRESENT, ABSENT, LATE, HALF_DAY, and ON_LEAVE
- Employees can check in once per day
- Employees cannot create duplicate attendance records for the same date

## Leave Rules
- Leave status values include PENDING, APPROVED, and REJECTED
- Leave types include SICK, CASUAL, ANNUAL, and OTHER
- Leave requests are created in PENDING status by default
- Only HR/Admin can approve or reject leave

## Project Architecture
The project follows a layered architecture:

Routes -> Controllers -> Services -> Models -> MongoDB

This keeps routing separate from business logic and database logic.

## Folder Structure
- backend/ - server, routes, controllers, models, config, middleware, services
- frontend/ - HTML, CSS, and JavaScript files for the user interface
- README.md - project documentation

## Installation
1. Open the backend directory.
2. Run npm install
3. Create your backend/.env file with your MongoDB URI and JWT secret.
4. Start the backend with npm start.

## Environment Variables
Required variables:
- PORT=5000
- MONGO_URI=
- JWT_SECRET=

## Running the Backend
From the backend folder:

npm install
npm start

## Running the Frontend
Open the frontend HTML files directly in the browser, or host the frontend with a simple local web server when the project progresses further.

## API Documentation
The backend is structured around the following planned endpoints:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/attendance/check-in
- POST /api/attendance/check-out
- GET /api/attendance/my-attendance
- POST /api/leaves
- GET /api/leaves/my-leaves
- GET /api/leaves
- PUT /api/leaves/:id/approve
- PUT /api/leaves/:id/reject
- POST /api/corrections
- GET /api/corrections
- PUT /api/corrections/:id/approve
- PUT /api/corrections/:id/reject
- GET /api/employees
- GET /api/employees/:id
- GET /api/reports/attendance

These routes are planned for later phases and are not fully implemented yet.

## Security
- Do not commit .env files
- Use bcryptjs for password hashing
- Use JWT for authentication
- Use Helmet, CORS, and rate limiting
- Validate incoming requests
- Keep sensitive configuration in environment variables

## Future Improvements
- Full authentication flow
- Employee and HR dashboards
- Real attendance calculations and working-hours logic
- Leave approval workflows
- Correction approval workflows
- Attendance reporting and analytics
- Notification center
- Admin management screens

This project is currently in the foundation phase only.
