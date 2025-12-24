/**
 * HURE Core - Main Express Server
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const onboardRoutes = require('./routes/onboard');
const authRoutes = require('./routes/auth');
const clinicsRoutes = require('./routes/clinics');
const subscriptionsRoutes = require('./routes/subscriptions');
const transactionsRoutes = require('./routes/transactions');
const promosRoutes = require('./routes/promos');
const auditRoutes = require('./routes/audit');
const siteContentRoutes = require('./routes/site-content');

// Employer Portal routes
const staffRoutes = require('./routes/staff');
const staffAuthRoutes = require('./routes/staff-auth');
const shiftsRoutes = require('./routes/shifts');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const locationsRoutes = require('./routes/locations');
const settingsRoutes = require('./routes/clinic-settings');

// Employee Portal routes
const employeeRoutes = require('./routes/employee');

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/onboard', onboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/promos', promosRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/site-content', siteContentRoutes);

// Employer Portal routes (scoped by clinic)
app.use('/api/clinics', staffRoutes);      // /api/clinics/:clinicId/staff
app.use('/api/clinics', shiftsRoutes);     // /api/clinics/:clinicId/shifts
app.use('/api/clinics', attendanceRoutes); // /api/clinics/:clinicId/attendance
app.use('/api/clinics', leaveRoutes);      // /api/clinics/:clinicId/leave
app.use('/api/clinics', locationsRoutes);  // /api/clinics/:clinicId/locations
app.use('/api/clinics', settingsRoutes);   // /api/clinics/:clinicId/settings

// Staff auth & invite routes (public - must be separate router to avoid route conflicts)
app.use('/api/staff', staffAuthRoutes);    // /api/staff/login, /api/staff/accept-invite, /api/staff/verify-invite

// Employee Portal routes (staff-authenticated)
app.use('/api/employee', employeeRoutes);  // /api/employee/profile, /api/employee/schedule, etc.

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server (for local development)
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 HURE Core API running at http://localhost:${PORT}`);
        console.log('📋 Routes:');
        console.log('   GET  /api/health');
        console.log('   POST /api/onboard/clinic');
        console.log('   POST /api/onboard/temp-password');
        console.log('   POST /api/onboard/verify-email');
        console.log('   POST /api/onboard/verify-otp');
        console.log('   GET  /api/clinics');
        console.log('   PATCH /api/clinics/:id/activate');
        console.log('   PATCH /api/clinics/:id/suspend');
        console.log('   PATCH /api/clinics/:id/reject');
        console.log('   GET  /api/subscriptions');
        console.log('   GET  /api/transactions');
        console.log('   GET  /api/promos');
        console.log('   GET  /api/audit');
        console.log('   GET  /api/site-content');
        console.log('');
        console.log('📋 Employer Portal Routes:');
        console.log('   GET/POST      /api/clinics/:clinicId/staff');
        console.log('   PATCH/DELETE  /api/clinics/:clinicId/staff/:staffId');
        console.log('   POST          /api/clinics/:clinicId/staff/:staffId/invite');
        console.log('   PATCH         /api/clinics/:clinicId/staff/:staffId/kyc');
        console.log('   GET/POST      /api/clinics/:clinicId/shifts');
        console.log('   PATCH         /api/clinics/:clinicId/shifts/:shiftId/assign');
        console.log('   GET/POST      /api/clinics/:clinicId/attendance');
        console.log('   POST          /api/clinics/:clinicId/attendance/clock-in');
        console.log('   POST          /api/clinics/:clinicId/attendance/clock-out');
        console.log('   GET           /api/clinics/:clinicId/attendance/export');
        console.log('   GET/POST      /api/clinics/:clinicId/leave');
        console.log('   GET/POST      /api/clinics/:clinicId/locations');
        console.log('   GET/PATCH     /api/clinics/:clinicId/settings');
    });
}

module.exports = app;
