# Employee Attendance Management System

## 1. Project Title

**Employee Attendance Management System**

## 2. Assignment Objective

The objective of this project is to provide a role-based web application for employee registration and login, daily attendance recording, working-time calculation, leave management and deduction, dashboards, and attendance-status tracking. The implementation also provides administration, reporting, notifications, attendance-correction, audit, and password-reset capabilities.

## 3. Project Overview

The system is a browser-based employee attendance application with separate EMPLOYEE, HR, and ADMIN workspaces. Employees record server-timed check-ins and check-outs, view attendance history, manage leave requests, request attendance corrections, and update their own profiles. HR users manage people and departments, review leave and correction requests, view reports, notifications, audit logs, and HR metrics. ADMIN users additionally manage user roles and account status and define office start/end times used by attendance calculations.

The frontend is implemented with HTML, CSS, and vanilla JavaScript. The backend is an Express application backed by MongoDB through Mongoose.

## 4. Key Features

- Employee self-registration, login, logout, session validation, and profile updates.
- JWT-based authentication and database-backed role authorization.
- Server-timed attendance check-in and check-out with duplicate prevention.
- Working minutes, working hours, overtime, and late-minute calculation.
- Attendance statuses: `PRESENT`, `LATE`, `HALF_DAY`, `ABSENT`, and `ON_LEAVE`.
- Leave requests, balances, overlap validation, approval, rejection, and cancellation.
- Attendance-correction requests with HR/ADMIN review and recalculation.
- HR employee and department management with filters and pagination.
- HR dashboard metrics, attendance/leave reports, and CSV export in the frontend.
- Private notifications and protected audit logs.
- ADMIN user role/status management and office-time settings.
- Forgot-password and reset-password workflow.
- OpenAPI/Swagger documentation and automated backend/frontend tests.

## 5. Technology Stack

| Area | Implementation |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Backend | Node.js, Express 4 |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | JSON Web Tokens (`jsonwebtoken`) |
| Password hashing | `bcryptjs` |
| Security middleware | Helmet, CORS, `express-rate-limit` |
| Email integration | Nodemailer, when SMTP environment variables are configured |
| API documentation | OpenAPI 3.0.3 and Swagger UI |
| Testing | Node.js built-in test runner |

## 6. System Architecture

```text
Browser pages (HTML/CSS/JavaScript)
          |
          | fetch requests through frontend/js/api.js
          v
Express API (/api)
          |
          +--> authentication and role middleware
          |
          v
Routes --> Controllers --> Services / utilities --> Mongoose models --> MongoDB
                         |
                         +--> notifications and audit logs
```

- **Routes** declare endpoints and apply authentication/role requirements.
- **Controllers** validate request flow, coordinate database updates, and return JSON responses.
- **Services** centralize attendance status, leave, notification, email, and system-settings logic.
- **Models** define MongoDB collections, validation, relationships, and indexes.
- **Frontend API utility** manages the JWT, API base URL, request errors, session checks, and toast messages.

## 7. User Roles

### Employee

- Register an employee account and sign in.
- View and update their own name/email profile fields.
- Check in, check out, and view personal attendance history.
- Submit and cancel pending leave requests.
- Submit attendance-correction requests for their own attendance.
- View and mark their own notifications as read.

### HR

- All HR operations require authentication and the `HR` or `ADMIN` role where applicable.
- View, create, and update employees; HR cannot assign the `ADMIN` role.
- Manage departments.
- View attendance-management records and HR dashboard metrics.
- Review leave and attendance-correction requests.
- View attendance/leave reports, notifications, and audit logs.

### Admin

- Has HR capabilities.
- Updates user roles and activates/deactivates accounts.
- Views and updates office start/end settings.
- Office timing updates are audited and restricted to `ADMIN`.

## 8. Functional Modules

### Registration & Login

Registration validates name, employee ID, email, and an eight-character minimum password. Registration always creates an `EMPLOYEE` account. Login verifies the bcrypt password hash and returns a JWT with a seven-day expiry.

### Attendance Check-In/Check-Out

The server, rather than the client, records check-in and check-out timestamps. One attendance record is allowed per employee per UTC-normalized working date. Checkout requires a prior check-in, can occur once, and must be later than check-in.

### Working Hours Calculation

`workingMinutes` is the elapsed whole-minute difference between check-in and check-out. The stored `workingHours` value is `workingMinutes / 60`. Overtime is the positive amount above the expected working minutes calculated from the ADMIN-defined office span minus the configured 60-minute break.

### Leave Management & Deduction

Employees submit `SICK`, `CASUAL`, `ANNUAL`, or `OTHER` leave requests. The system validates date order, reason length, available balance, and overlap with pending/approved leave. An HR user or ADMIN approves or rejects a pending request. Approval deducts the balance once and records the reviewer; rejection requires a comment. Employees can cancel only their own pending requests.

### Attendance Status Tracking

The status service applies leave first, then weekend/holiday handling, then check-in and duration rules. Late minutes are calculated from the configured office start time. The half-day threshold is stored in system settings and defaults to 240 minutes.

### Employee Dashboard

The employee workspace provides attendance state, attendance history, leave, corrections, notifications, and profile access. The client-side dashboard state disables inappropriate check-in/check-out actions after completion.

### HR Dashboard

The HR dashboard returns employee count, attendance-status totals, pending leave count, attendance percentage, department comparison, and date-based attendance trends. It supports optional department and date filters.

### Admin Management

ADMIN users manage user details, roles, and active status. Privileged role/status changes create audit records. ADMIN users also configure office start/end times through `/api/admin/settings`.

### Reports

HR and ADMIN users retrieve attendance and leave report data filtered by employee, department, date range, and status. The frontend report module exports selected report data to CSV and escapes CSV values.

### Notifications

Notifications belong to a specific user. Users can list their notifications, request an unread count, and mark only their own notification as read. Notifications are created for selected attendance, leave, and correction events.

### Attendance Corrections

An employee can request a corrected check-in and/or checkout for an attendance record they own. A meaningful reason is required, and only one pending correction is permitted per attendance record. HR or ADMIN approval updates attendance data and recalculates working time, overtime, late minutes, and status.

### Forgot Password

The forgot-password endpoint returns the same generic success message for known and unknown email addresses. For a known account, it creates a cryptographically random token, stores only a SHA-256 hash with a one-hour expiry, and sends email only when SMTP is configured. In development, a reset URL can be returned for local testing. Reset tokens are single-use.

## 9. Database Design

The application uses the following Mongoose models and MongoDB collections.

| Model | Main fields and purpose |
| --- | --- |
| `User` | Name, email, employee ID, password hash, reset-token hash/expiry, active state, role, department reference, leave balances, timestamps. |
| `Department` | Unique name, description, timestamps. |
| `Attendance` | Employee reference, UTC-normalized date, check-in/out, late/working/overtime minutes, working hours, status, timestamps. |
| `Leave` | Employee reference, leave type, dates, reason, calculated days, status, reviewer, review comment, deduction flag, timestamps. |
| `AttendanceCorrection` | Employee and attendance references, requested times, reason, status, reviewer/review details, timestamps. |
| `Notification` | User reference, message, read state, timestamps. |
| `AuditLog` | Optional user reference, action, details, timestamps. |
| `Holiday` | Unique date and name, used by attendance-status logic. |
| `SystemSettings` | Singleton-style key, office start/end, break minutes, half-day threshold, timestamps. |

### Important Relationships

```text
Department 1 <----- * User
User       1 <----- * Attendance
User       1 <----- * Leave
User       1 <----- * Notification
User       1 <----- * AuditLog (optional actor)
Attendance 1 <---- * AttendanceCorrection
User       1 <----- * AttendanceCorrection (requester/reviewer)
User       1 <----- * Leave (employee/reviewer)
```

### Important Indexes

- `User.email`: unique.
- `User.employeeId`: unique and sparse.
- `Department.name`: unique.
- `Holiday.date`: unique.
- `SystemSettings.key`: unique.
- `Attendance(employee, date)`: unique; prevents duplicate daily attendance.
- `Leave`: employee/history, status/history, and employee/status/date-range indexes.
- `AttendanceCorrection`: attendance/status and status/created-date indexes.
- `Notification`: user/history and user/read indexes.
- `AuditLog`: created-date and action/created-date indexes.

## 10. Authentication & Authorization

After successful login, the API returns a signed JWT. The frontend stores the token locally and sends it as `Authorization: Bearer <token>` for protected requests.

Authentication middleware verifies the token, loads the current user from MongoDB, and rejects missing, invalid, expired, unknown, or inactive accounts. Authorization middleware checks the role from the database user record, so a forged role claim in a token does not grant extra privileges. Self-profile updates only allow name and email, preventing role or active-status escalation.

## 11. Security Measures

- Passwords are bcrypt hashes; password fields are excluded from normal user responses.
- Reset tokens are random, stored as SHA-256 hashes, expire after one hour, and are cleared after use.
- Login/register endpoints are rate limited to 20 attempts per 15 minutes.
- Forgot/reset password endpoints are rate limited to 5 attempts per 15 minutes.
- Helmet applies HTTP security headers.
- CORS accepts localhost/127.0.0.1 for development and configured origins through `CORS_ORIGIN`.
- Protected routes use JWT authentication and role middleware.
- Search input is escaped and bounded; pagination limits are clamped.
- Mongoose/ObjectId and payload validation return controlled errors.
- Request logging excludes keys containing password, token, secret, or credential.
- `.env` and dependency folders are ignored by Git; environment values are not documented in this file.

## 12. Attendance Business Rules

1. The working date is normalized to UTC midnight.
2. Check-in/check-out timestamps are generated by the server.
3. Only one attendance record can exist for an employee/date pair.
4. Checkout requires a check-in, must occur after it, and cannot be repeated.
5. Default office settings are 09:30–18:30 UTC, with 60 assumed break minutes and a 240-minute half-day threshold. ADMIN can change office start/end times.
6. A check-in after the configured office start is `LATE`; late minutes are recorded.
7. A completed attendance record below the half-day threshold is `HALF_DAY`.
8. Approved leave produces `ON_LEAVE` before other attendance decisions.
9. Weekend or holiday attendance status is `ABSENT`.
10. Overtime is positive working minutes above the configured expected working minutes.

## 13. Leave Business Rules

1. Leave types are `SICK`, `CASUAL`, `ANNUAL`, and `OTHER`.
2. Default balances are 10, 10, 20, and 5 days respectively.
3. Dates are UTC-normalized, inclusive, and the start date cannot follow the end date.
4. A reason must contain at least three characters.
5. Requests cannot overlap pending or approved leave.
6. The requested number of days must fit the employee's current balance.
7. Only HR/ADMIN can review requests.
8. Approval occurs only while pending and deducts the balance once.
9. Rejection requires a review comment.
10. Employees can cancel only their own pending requests.

## 14. Correction Workflow

```text
Employee submits correction request
        |
        v
PENDING correction (one per attendance record)
        |
        +--> HR/ADMIN rejects --> reviewer/comment saved --> employee notified
        |
        +--> HR/ADMIN approves --> attendance recalculated --> audit + notification
```

Correction approval updates allowed corrected times, then recalculates working minutes, overtime, late minutes, working hours, and attendance status. The reviewer and review timestamp are stored.

## 15. API Overview

All endpoints are prefixed with `/api`. The following route groups are implemented:

| Route group | Implemented purpose |
| --- | --- |
| `/auth` | Registration, login, forgot/reset password, current-user retrieval and profile update. |
| `/attendance` | Check-in, checkout, personal attendance history, and HR/ADMIN management view. |
| `/leaves` | Leave creation, personal/history lists, pending list, approval, rejection, and cancellation. |
| `/corrections` | Correction creation, review list, approval, and rejection. |
| `/employees` | HR/ADMIN employee listing, creation, update, and ADMIN status updates. |
| `/departments` | HR/ADMIN department listing, creation, and update. |
| `/reports` | HR/ADMIN attendance and leave report data. |
| `/notifications` | Current user's notification list, unread count, and read state. |
| `/audit-logs` | HR/ADMIN audit-log listing. |
| `/dashboards` | HR/ADMIN dashboard metrics. |
| `/admin` | ADMIN user management and office-time settings. |

## 16. Swagger/API Documentation

Swagger UI is served by the backend at:

```text
http://localhost:5000/api-docs/
```

The current OpenAPI definition contains 42 documented operations, including authentication, password reset, attendance, leave, corrections, reporting, notifications, audits, dashboards, users, and office-time settings.

## 17. UI/UX and Responsive Design

The interface uses reusable cards, form groups, badges, tables, modal dialogs, toast notifications, loading/error states, and role-specific navigation. CSS provides responsive behavior through breakpoints at 800px and 520px. On smaller screens, the main shell becomes single-column, navigation can scroll horizontally, form grids become single-column, actions wrap, and tables retain horizontal scroll through a table wrapper. Login includes an accessible show/hide password control.

## 18. Project Folder Structure

```text
backend/
  config/          MongoDB connection configuration
  controllers/     Request handlers
  docs/            OpenAPI definition
  middleware/      Authentication, errors, and request logging
  models/          Mongoose schemas
  routes/          Express route modules
  scripts/         Development helper scripts
  services/        Attendance, leave, notification, email, settings logic
  tests/           Backend and integration tests
  utils/           Response, date, audit, and error helpers
  app.js           Express configuration
  server.js        Application startup
frontend/
  css/             Shared stylesheet
  js/              API utility and page modules
  pages/           Role-specific HTML pages
  tests/           Frontend tests
  index.html       Landing page
  forgot-password.html / reset-password.html
```

## 19. Installation & Setup Instructions

1. Install Node.js 18 LTS or later and MongoDB locally.
2. Install backend packages:

   ```bash
   cd backend
   npm install
   ```

3. Copy `backend/.env.example` to `backend/.env`.
4. Set local environment values, including a MongoDB URI and a strong JWT secret.
5. Start MongoDB before starting the backend.

## 20. Environment Variables

Use `backend/.env.example` as the template. Do not commit the created `.env` file.

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port; defaults to 5000 when omitted. |
| `NODE_ENV` | Environment mode. Development enables the local reset-link response. |
| `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | Secret used to sign JWTs. |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins for non-local development. |
| `FRONTEND_URL` | Base frontend URL used in password-reset links. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP values used only when all are configured. |

## 21. MongoDB Setup

For local development, start a local MongoDB server and set `MONGO_URI` in `backend/.env`. The backend connects through `backend/config/database.js` and requires a defined URI.

For deployment preparation, MongoDB Atlas can be used by creating an Atlas database user, allowing the deployment host's network access, and placing the Atlas connection string in the deployment platform's secret/environment configuration. Atlas deployment has not been claimed as completed by this project.

## 22. How to Run the Application

Start the backend:

```bash
cd backend
npm start
```

Serve the `frontend/` directory from a static web server and open `index.html`. For local or `file:` frontend usage, the API utility targets `http://localhost:5000/api`. For a separately hosted frontend, set `window.ATTENDANCE_API_BASE` before loading `frontend/js/api.js` and configure the same origin in `CORS_ORIGIN`.

## 23. Testing

Backend tests use Node's built-in runner and isolated MongoDB test database names. Coverage includes authentication, attendance boundaries, employee/department management, leave workflow, corrections, notifications, audit logs, dashboards, reports, password reset, Day 26 administration tests, Day 27 integration tests, and Day 28 security tests.

Frontend tests cover role redirects, dashboard state, logout/session behavior, password-reset pages, and safe UI rendering.

```bash
cd backend
npm test

# From repository root
node --test frontend/tests/*.test.js
```

## 24. Test Results

The latest complete automated regression run recorded:

| Suite | Result |
| --- | --- |
| Backend | 41 passed, 0 failed, 0 skipped |
| Frontend | 13 passed, 0 failed, 0 skipped |
| Day 28 security coverage | Included in the backend result; 5 security tests passed |
| Live ADMIN settings request | `GET` 200 and `PUT` 200 after backend restart |
| Swagger UI | HTTP 200 at `/api-docs/` |

## 25. Sample User Roles/Accounts

No account passwords, secrets, or reset tokens are documented here. Create accounts through registration for EMPLOYEE access. HR and ADMIN accounts should be created or assigned by an authorized administrator through the application or controlled development setup.

## 26. Deployment Preparation

The backend supports deployment configuration through `PORT`, `MONGO_URI`, CORS, JWT, frontend URL, and optional SMTP environment variables. The frontend can be served statically, while the backend runs with `npm start`. Before deployment, use a strong unique JWT secret, HTTPS at the hosting platform, specific CORS origins, protected platform secrets, and a production MongoDB instance such as MongoDB Atlas.

## 27. Known Limitations

- Production deployment and real SMTP delivery have not been verified or claimed.
- Dates and office timings are evaluated in UTC; there is no per-user or per-location timezone configuration.
- Holidays are represented by a model and used by status logic, but this source version exposes no holiday-management API or UI.
- Existing JWTs remain valid until normal expiry after a password reset; there is no token-version invalidation field.
- The current ADMIN user-management UI does not contain a special safeguard against an administrator changing their own role or active status.
- Automated tests do not replace manual browser checks across every viewport and full end-to-end user journey.

## 28. Future Improvements

- Add configurable timezones, working calendars, and holiday administration.
- Add token-version invalidation after password changes or resets.
- Add ADMIN self-protection rules for role/status updates.
- Add richer dashboard visualizations and more report formats.
- Add automated browser-based responsive and end-to-end tests.
- Add deployment CI/CD, health monitoring, backups, and production email verification.

## 29. Conclusion

The Employee Attendance Management System implements the assignment's required login/registration, attendance, working-time, leave-deduction, dashboard, and attendance-status capabilities in a modular Express/MongoDB application. The implementation extends those core requirements with role-based administration, corrections, notifications, audits, reports, password recovery, Swagger documentation, and automated regression coverage. Its separation of frontend, routes, controllers, services, models, and middleware makes the system understandable, testable, and suitable as a software development assignment submission.
