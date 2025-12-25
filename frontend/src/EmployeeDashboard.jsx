import { useState, useEffect, useMemo } from 'react';
import * as employeeApi from './employeeApi';

export default function EmployeeDashboard() {
    const [view, setView] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State
    const [profile, setProfile] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [activePunch, setActivePunch] = useState(null);

    // Modals
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const todayISO = new Date().toISOString().slice(0, 10);

    // Load initial data
    useEffect(() => {
        // Check if authenticated before loading
        if (!employeeApi.isStaffAuthenticated()) {
            window.location.href = '/employee/login';
            return;
        }
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [profileData, scheduleData, attendanceData, leaveData, docsData] = await Promise.all([
                employeeApi.getProfile(),
                employeeApi.getSchedule(),
                employeeApi.getAttendance(),
                employeeApi.getLeaveRequests(),
                employeeApi.getDocuments()
            ]);

            setProfile(profileData.staff);
            setSchedule(scheduleData.shifts || []);
            setAttendance(attendanceData.attendance || []);
            setLeaves(leaveData.leaves || []);
            setDocuments(docsData.documents || []);

            // Check for active clock-in
            const active = attendanceData.attendance?.find(a => a.clock_in && !a.clock_out);
            if (active) {
                setActivePunch({
                    id: active.id,
                    date: active.date,
                    in: active.clock_in
                });
            }

            setLoading(false);
        } catch (err) {
            setError(err.message || 'Failed to load data');
            setLoading(false);
            if (err.message.includes('Unauthorized') || err.message.includes('token')) {
                employeeApi.clearStaffAuth();
                window.location.href = '/employee/login';
            }
        }
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    // Title case helper for proper name formatting
    function toTitleCase(str) {
        if (!str) return '';
        return str.toLowerCase().split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Human-readable date format with weekday (e.g., "Wed, 24 Dec 2025")
    function formatDateWithDay(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    // Short date format (e.g., "24 Dec 2025")
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    // Format time for display (e.g., "18:21")
    function formatShiftTime(timeStr) {
        if (!timeStr) return '';
        // Handle full timestamp or time-only string
        if (timeStr.includes('T')) {
            return new Date(timeStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
        return timeStr.slice(0, 5); // HH:MM from HH:MM:SS
    }

    // Format time range (e.g., "18:21 – 18:47")
    function formatTimeRange(startTime, endTime) {
        return `${formatShiftTime(startTime)} – ${formatShiftTime(endTime)}`;
    }

    // Employee-facing status labels for ASSIGNED shifts (not available)
    function getEmployeeShiftStatus(status) {
        switch (status?.toLowerCase()) {
            case 'open': return 'Available'; // This shouldn't show in "Your Shifts"
            case 'assigned': return 'Scheduled';
            case 'confirmed': return 'Confirmed';
            case 'declined': return 'Declined';
            case 'completed': return 'Completed';
            default: return 'Scheduled';
        }
    }

    // Check if a shift is an "available" shift (not yet assigned to this employee)
    function isAvailableShift(shift) {
        return shift.isOpenShift || shift.status?.toLowerCase() === 'open';
    }

    // Clean location string (remove trailing dots, proper formatting)
    function cleanLocation(str) {
        if (!str) return '';
        return str.replace(/\s*\.\s*$/, '').trim();
    }

    // ============================================
    // COMPUTED VALUES
    // ============================================

    const fullName = profile ? toTitleCase(`${profile.first_name} ${profile.last_name}`) : '';
    const clinicName = profile?.clinic_name ? toTitleCase(cleanLocation(profile.clinic_name)) : '';
    const locationName = profile?.location_name ? toTitleCase(cleanLocation(profile.location_name)) : '';

    const nextShift = useMemo(() =>
        schedule
            .filter(s => s.date >= todayISO && s.status !== 'Declined')
            .sort((a, b) => a.date.localeCompare(b.date))[0] || null,
        [schedule, todayISO]
    );

    const todayShift = useMemo(() =>
        schedule.find(s => s.date === todayISO) || null,
        [schedule, todayISO]
    );

    function daysUntil(dateStr) {
        if (!dateStr) return null;
        const oneDay = 24 * 60 * 60 * 1000;
        const d = new Date(dateStr + 'T00:00:00');
        const now = new Date();
        return Math.round((d.getTime() - new Date(now.toDateString()).getTime()) / oneDay);
    }

    const licenseDays = profile?.license_expiry ? daysUntil(profile.license_expiry) : null;
    const licenseExpiringSoon = licenseDays !== null && licenseDays <= 30 && licenseDays >= 0;
    const licenseExpired = licenseDays !== null && licenseDays < 0;

    const needsReminder = licenseExpired || licenseExpiringSoon || profile?.kyc_status !== 'verified';

    // Actions
    async function handleClockIn() {
        if (activePunch) {
            alert('You are already clocked in.');
            return;
        }
        try {
            const result = await employeeApi.clockIn();
            setActivePunch({
                id: result.attendance.id,
                date: result.attendance.date,
                in: result.attendance.clock_in
            });
            await loadData(); // Refresh attendance list
        } catch (err) {
            alert(err.message || 'Failed to clock in');
        }
    }

    async function handleClockOut() {
        if (!activePunch) {
            alert('You are not clocked in.');
            return;
        }
        try {
            await employeeApi.clockOut();
            setActivePunch(null);
            await loadData(); // Refresh attendance list
        } catch (err) {
            alert(err.message || 'Failed to clock out');
        }
    }

    async function confirmShift(shiftId) {
        try {
            await employeeApi.respondToShift(shiftId, 'confirmed');
            setSchedule(prev => prev.map(s =>
                s.id === shiftId ? { ...s, status: 'confirmed', decline_reason: null } : s
            ));
        } catch (err) {
            alert(err.message || 'Failed to confirm shift');
        }
    }

    async function declineShift(shiftId) {
        const reason = window.prompt('Reason for declining (optional)') || '';
        try {
            await employeeApi.respondToShift(shiftId, 'declined', reason);
            setSchedule(prev => prev.map(s =>
                s.id === shiftId ? { ...s, status: 'declined', decline_reason: reason } : s
            ));
        } catch (err) {
            alert(err.message || 'Failed to decline shift');
        }
    }

    async function acknowledgeDocument(docId) {
        try {
            await employeeApi.acknowledgeDocument(docId);
            setDocuments(prev => prev.map(d =>
                d.id === docId ? { ...d, acknowledged: true, acknowledged_at: new Date().toISOString() } : d
            ));
        } catch (err) {
            alert(err.message || 'Failed to acknowledge document');
        }
    }

    function exportAttendance() {
        const headers = ['date', 'clock_in', 'clock_out'];
        const rows = attendance.map(a => ({
            date: a.date,
            clock_in: a.clock_in || '',
            clock_out: a.clock_out || ''
        }));
        const csv = [
            headers.join(','),
            ...rows.map(r => headers.map(h => `"${r[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my_attendance.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleLogout() {
        employeeApi.clearStaffAuth();
        window.location.href = '/employee/login';
    }

    const viewTitle = {
        dashboard: `Hi ${fullName}`,
        schedule: 'My Schedule',
        attendance: 'My Attendance',
        leave: 'My Leave',
        docs: 'Docs & Policies',
        compliance: 'My Compliance Docs',
        profile: 'My Profile'
    }[view] || 'Employee Portal';

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
                    <div className="text-red-500 text-center mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Error</h2>
                    <p className="text-gray-600 text-center">{error}</p>
                    <button
                        onClick={loadData}
                        className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <div className="flex">
                {/* Mobile Menu Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md border"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {sidebarOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>

                {/* Sidebar Overlay for Mobile */}
                {sidebarOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar - Enhanced with dark theme */}
                <aside className={`
                    fixed lg:sticky top-0 left-0 z-40
                    w-64 lg:w-72 bg-gradient-to-b from-slate-900 to-slate-800 h-screen flex flex-col
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    <div className="p-5 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold">
                                H
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">HURE Core</div>
                                <div className="text-xs text-slate-400">Employee Portal</div>
                            </div>
                        </div>
                    </div>

                    <nav className="p-4 space-y-1 text-sm flex-1 overflow-y-auto">
                        {/* Work Section */}
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-3">Work</div>
                        <button
                            onClick={() => setView('dashboard')}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${view === 'dashboard' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        >
                            <span>🏠</span>
                            Home
                        </button>
                        <button
                            onClick={() => setView('schedule')}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${view === 'schedule' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        >
                            <span>📅</span>
                            Schedule
                        </button>
                        <button
                            onClick={() => setView('attendance')}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${view === 'attendance' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        >
                            <span>⏰</span>
                            Attendance
                        </button>
                        <button
                            onClick={() => setView('leave')}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${view === 'leave' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        >
                            <span>🏖️</span>
                            Leave
                        </button>

                        {/* Documents Section */}
                        <div className="text-xs text-slate-500 uppercase tracking-wider mt-6 mb-3 px-3">Documents</div>
                        <button
                            onClick={() => setView('docs')}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${view === 'docs' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        >
                            <span>📄</span>
                            Docs & Policies
                        </button>
                        <button
                            onClick={() => setView('compliance')}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${view === 'compliance' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        >
                            <span>🛡️</span>
                            My Compliance Docs
                        </button>

                        {/* Account Section */}
                        <div className="text-xs text-slate-500 uppercase tracking-wider mt-6 mb-3 px-3">Account</div>
                        <button
                            onClick={() => setView('profile')}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${view === 'profile' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        >
                            <span>👤</span>
                            Profile
                        </button>
                    </nav>

                    <div className="p-4 border-t border-slate-700 space-y-2">
                        {/* Admin View Button - only show for admin/owner role */}
                        {(profile?.account_role === 'admin' || profile?.account_role === 'owner') && (
                            <button
                                onClick={() => {
                                    // Set clinic ID for employer dashboard
                                    if (profile?.clinic_id) {
                                        localStorage.setItem('hure_clinic_id', profile.clinic_id);
                                    }
                                    window.location.href = '/employer';
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl flex items-center gap-3 transition-colors"
                            >
                                <span>⚡</span>
                                Switch to Admin View
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl flex items-center gap-3 transition-colors"
                        >
                            <span>🚪</span>
                            Logout
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6 lg:p-10 pt-16 lg:pt-10">
                    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <h1 className="text-xl lg:text-2xl font-semibold">{viewTitle}</h1>
                            <p className="text-xs lg:text-sm text-gray-500 mt-1">
                                {clinicName}{locationName ? ` · ${locationName}` : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm font-medium">{profile?.role}</div>
                            </div>
                            <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                                {profile?.first_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                        </div>
                    </header>

                    {/* Dashboard View */}
                    {view === 'dashboard' && (
                        <div>
                            {needsReminder && (
                                <div className="mb-4 p-4 rounded-lg bg-amber-50 border-l-4 border-amber-500">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="font-semibold text-amber-900 text-base">Action needed</div>
                                            <div className="text-sm text-amber-800 mt-1">
                                                {licenseExpired && 'Your license has expired'}
                                                {licenseExpiringSoon && !licenseExpired && `License expires in ${licenseDays} day${licenseDays !== 1 ? 's' : ''}`}
                                                {profile?.kyc_status !== 'verified' && !licenseExpired && !licenseExpiringSoon && 'Verification pending'}
                                                {profile?.kyc_status !== 'verified' && (licenseExpired || licenseExpiringSoon) && ' · Verification pending'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setView('profile')}
                                            className="px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 whitespace-nowrap"
                                        >
                                            {licenseExpired || licenseExpiringSoon ? 'Update license' : 'Complete verification'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400 uppercase tracking-wide">Status</div>
                                    <div className="mt-2 text-sm font-semibold capitalize text-green-600">
                                        {profile?.employment_status || '—'}
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400 uppercase tracking-wide">Verification</div>
                                    <div className={`mt-2 text-sm font-semibold capitalize ${profile?.kyc_status === 'verified' ? 'text-green-600' : 'text-amber-600'}`}>
                                        {profile?.kyc_status?.replace(/_/g, ' ') || '—'}
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400 uppercase tracking-wide">License</div>
                                    <div className="mt-2 text-sm font-medium">{profile?.license_type || '—'}</div>
                                    <div className="text-xs text-gray-500">{profile?.license_number || ''}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400 uppercase tracking-wide">License Expiry</div>
                                    {licenseExpired ? (
                                        <div className="mt-2">
                                            <div className="text-sm font-bold text-red-600">Expired</div>
                                            <div className="text-xs text-gray-500">{formatDate(profile?.license_expiry)}</div>
                                        </div>
                                    ) : licenseExpiringSoon ? (
                                        <div className="mt-2">
                                            <div className="text-sm font-bold text-amber-600">{licenseDays} day{licenseDays !== 1 ? 's' : ''} left</div>
                                            <div className="text-xs text-gray-500">{formatDate(profile?.license_expiry)}</div>
                                        </div>
                                    ) : (
                                        <div className="mt-2 text-sm font-medium text-green-600">
                                            {profile?.license_expiry ? formatDate(profile.license_expiry) : '—'}
                                        </div>
                                    )}
                                </div>
                            </section>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-lg font-semibold">Upcoming Shifts</h2>
                                        {nextShift && (
                                            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                Next: {formatDate(nextShift.date)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        {schedule.filter(s => s.date >= todayISO).slice(0, 5).map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-3 rounded-md bg-gray-50 border">
                                                <div>
                                                    <div className="text-sm font-medium">
                                                        {formatDate(s.date)} • {formatShiftTime(s.start_time)} – {formatShiftTime(s.end_time)}
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-0.5">
                                                        {s.role} • <span className={`${s.status === 'confirmed' ? 'text-green-600' : s.status === 'declined' ? 'text-red-600' : 'text-blue-600'}`}>{getEmployeeShiftStatus(s.status)}</span>
                                                    </div>
                                                    {s.decline_reason && (
                                                        <div className="text-xs text-red-500 mt-1">Reason: {s.decline_reason}</div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {s.status === 'assigned' && (
                                                        <>
                                                            <button
                                                                onClick={() => confirmShift(s.id)}
                                                                className="text-xs border border-green-200 bg-green-50 text-green-700 rounded px-3 py-1.5 hover:bg-green-100"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => declineShift(s.id)}
                                                                className="text-xs border border-red-200 bg-red-50 text-red-600 rounded px-3 py-1.5 hover:bg-red-100"
                                                            >
                                                                Decline
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {schedule.filter(s => s.date >= todayISO).length === 0 && (
                                            <p className="text-gray-500 text-sm py-4 text-center">No upcoming shifts scheduled</p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                                    <div className="space-y-2">
                                        {/* Conditional Clock In/Out */}
                                        {activePunch ? (
                                            <>
                                                <button
                                                    onClick={handleClockOut}
                                                    className="w-full px-3 py-2.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                                                >
                                                    Clock Out
                                                </button>
                                                <div className="text-xs text-gray-500 text-center">
                                                    Clocked in at {formatShiftTime(activePunch.in)}
                                                </div>
                                            </>
                                        ) : todayShift ? (
                                            <>
                                                <button
                                                    onClick={handleClockIn}
                                                    className="w-full px-3 py-2.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                                                >
                                                    Clock In
                                                </button>
                                                <div className="text-xs text-gray-500 text-center">
                                                    Today: {formatShiftTime(todayShift.start_time)} – {formatShiftTime(todayShift.end_time)}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-3 text-gray-500 text-sm bg-gray-50 rounded-md border border-dashed">
                                                No shift scheduled today
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setView('attendance')}
                                            className="w-full px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                        >
                                            View attendance
                                        </button>
                                        <button
                                            onClick={() => setView('leave')}
                                            className="w-full px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                        >
                                            Request leave
                                        </button>
                                        <button
                                            onClick={() => setView('profile')}
                                            className="w-full px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                        >
                                            Update profile
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Schedule View */}
                    {view === 'schedule' && (
                        <div className="space-y-6">
                            {/* Your Scheduled Shifts */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-lg font-semibold">Your Shifts</h2>
                                        <p className="text-sm text-gray-500">Shifts assigned to you</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {schedule.filter(s => !isAvailableShift(s) && s.date >= todayISO).length > 0 ? (
                                        schedule.filter(s => !isAvailableShift(s) && s.date >= todayISO).map(s => (
                                            <div key={s.id} className="p-4 rounded-lg border bg-gray-50">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900">
                                                            {formatDateWithDay(s.date)}
                                                        </div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            {formatTimeRange(s.start_time, s.end_time)}
                                                        </div>
                                                        <div className="text-sm text-gray-500 mt-1">
                                                            {s.role}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-1">
                                                            Location: {toTitleCase(cleanLocation(s.location || profile?.location_name || profile?.clinic_name || 'Not specified'))}
                                                        </div>
                                                        {s.decline_reason && (
                                                            <div className="text-xs text-red-500 mt-2">Reason: {s.decline_reason}</div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                            s.status === 'declined' ? 'bg-red-100 text-red-700' :
                                                                s.status === 'completed' ? 'bg-gray-200 text-gray-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {getEmployeeShiftStatus(s.status)}
                                                        </span>
                                                        {s.status === 'assigned' && (
                                                            <div className="flex gap-2 mt-2">
                                                                <button
                                                                    onClick={() => confirmShift(s.id)}
                                                                    className="text-xs border border-green-200 bg-green-50 text-green-700 rounded px-3 py-1.5 hover:bg-green-100"
                                                                >
                                                                    Confirm
                                                                </button>
                                                                <button
                                                                    onClick={() => declineShift(s.id)}
                                                                    className="text-xs border border-red-200 bg-red-50 text-red-600 rounded px-3 py-1.5 hover:bg-red-100"
                                                                >
                                                                    Decline
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500">You have no upcoming shifts scheduled.</p>
                                            {nextShift && nextShift.date > todayISO && (
                                                <p className="text-sm text-gray-400 mt-2">
                                                    Your next shift is on {formatDate(nextShift.date)}.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Available Shifts Section */}
                            {schedule.filter(s => isAvailableShift(s) && s.date >= todayISO).length > 0 && (
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h2 className="text-lg font-semibold">Available Shifts</h2>
                                            <p className="text-sm text-gray-500">Shifts you can accept</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {schedule.filter(s => isAvailableShift(s) && s.date >= todayISO).map(s => (
                                            <div key={s.id} className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900">
                                                            {formatDateWithDay(s.date)}
                                                        </div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            {formatTimeRange(s.start_time, s.end_time)}
                                                        </div>
                                                        <div className="text-sm text-gray-500 mt-1">
                                                            {s.role}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-1">
                                                            Location: {toTitleCase(cleanLocation(s.location || profile?.location_name || profile?.clinic_name || 'Not specified'))}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => confirmShift(s.id)}
                                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                                                    >
                                                        Accept Shift
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Attendance View */}
                    {view === 'attendance' && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-4xl">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">My Attendance</h2>
                                    <p className="text-sm text-gray-500">{clinicName || locationName}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Present (Full shift) | Half Day | Absent
                                    </p>
                                </div>
                                <button
                                    onClick={exportAttendance}
                                    className="px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                >
                                    Export CSV
                                </button>
                            </div>

                            {attendance.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-gray-500 border-b">
                                            <th className="py-2">Date</th>
                                            <th className="py-2">Clock In</th>
                                            <th className="py-2">Clock Out</th>
                                            <th className="py-2">Hours Worked</th>
                                            <th className="py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendance.slice().reverse().map(a => {
                                            // Format timestamps to readable time
                                            const formatTimeStamp = (timestamp) => {
                                                if (!timestamp) return '—';
                                                const date = new Date(timestamp);
                                                return date.toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true
                                                });
                                            };

                                            // Calculate hours worked
                                            const hoursWorked = a.hours_worked || 0;
                                            const overtime = hoursWorked > 8 ? hoursWorked - 8 : 0;

                                            // Determine hours display
                                            const getHoursDisplay = () => {
                                                if (a.clock_out && hoursWorked > 0) {
                                                    return (
                                                        <div>
                                                            <span className="font-medium">{hoursWorked.toFixed(2)} hrs</span>
                                                            {overtime > 0 && (
                                                                <span className="text-xs text-purple-600 ml-1">
                                                                    +{overtime.toFixed(2)} OT
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                } else if (a.clock_in && !a.clock_out) {
                                                    return <span className="text-blue-500 italic">In progress</span>;
                                                } else {
                                                    return <span className="text-amber-500">Pending</span>;
                                                }
                                            };

                                            // Status badge colors
                                            const getStatusBadge = (status) => {
                                                switch (status) {
                                                    case 'present':
                                                        return 'bg-green-100 text-green-700';
                                                    case 'half_day':
                                                        return 'bg-yellow-100 text-yellow-700';
                                                    case 'absent':
                                                        return 'bg-red-100 text-red-700';
                                                    default:
                                                        return 'bg-blue-100 text-blue-700';
                                                }
                                            };

                                            const getStatusLabel = (status) => {
                                                switch (status) {
                                                    case 'present': return 'Present';
                                                    case 'half_day': return 'Half Day';
                                                    case 'absent': return 'Absent';
                                                    default: return 'Active';
                                                }
                                            };

                                            return (
                                                <tr key={a.id} className="border-b">
                                                    <td className="py-2">{formatDateWithDay(a.date)}</td>
                                                    <td className="py-2 text-green-600 font-medium">
                                                        {formatTimeStamp(a.clock_in)}
                                                    </td>
                                                    <td className="py-2 text-red-600 font-medium">
                                                        {a.clock_out ? formatTimeStamp(a.clock_out) : (
                                                            <span className="text-blue-500 italic">Active</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2">
                                                        {getHoursDisplay()}
                                                    </td>
                                                    <td className="py-2">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(a.status)}`}>
                                                            {getStatusLabel(a.status)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">You don't have any attendance records yet.</p>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Leave View */}
                    {view === 'leave' && (
                        <LeaveView
                            leaves={leaves}
                            showModal={showLeaveModal}
                            setShowModal={setShowLeaveModal}
                            onSubmit={async (data) => {
                                try {
                                    const result = await employeeApi.submitLeaveRequest(data);
                                    setLeaves(prev => [result.leave, ...prev]);
                                    setShowLeaveModal(false);
                                } catch (err) {
                                    alert(err.message || 'Failed to submit leave request');
                                }
                            }}
                        />
                    )}

                    {/* Documents View */}
                    {view === 'docs' && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-3xl">
                            <div className="mb-4">
                                <h2 className="text-lg font-semibold">Docs & Policies</h2>
                                <p className="text-sm text-gray-500">Documents and policies to read and acknowledge</p>
                            </div>
                            {documents.length > 0 ? (
                                <ul className="space-y-3">
                                    {documents.map(d => (
                                        <li key={d.id} className="p-3 border rounded-lg flex items-center justify-between bg-gray-50">
                                            <div>
                                                <div className="font-medium">{d.title}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {d.document_type}
                                                </div>
                                                {d.acknowledged && d.acknowledged_at && (
                                                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                        Acknowledged on {formatDate(d.acknowledged_at.slice(0, 10))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                {d.document_url && (
                                                    <a
                                                        href={d.document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        View
                                                    </a>
                                                )}
                                                {!d.acknowledged && (
                                                    <button
                                                        onClick={() => acknowledgeDocument(d.id)}
                                                        className="px-3 py-1.5 border rounded text-xs hover:bg-gray-100"
                                                    >
                                                        Acknowledge
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">No policies have been shared with you yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* My Compliance Docs View */}
                    {view === 'compliance' && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-3xl">
                            <div className="mb-4">
                                <h2 className="text-lg font-semibold">My Compliance Docs</h2>
                                <p className="text-sm text-gray-500">Upload and manage your required documents</p>
                            </div>

                            {/* License Information from Profile */}
                            {profile && (
                                <div className="space-y-4">
                                    {/* License Card */}
                                    <div className="p-4 border rounded-lg bg-gray-50">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-medium text-gray-900">Professional License</div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    {profile.license_type || 'Not specified'} {profile.license_number && `• ${profile.license_number}`}
                                                </div>
                                                {profile.license_expiry && (
                                                    <div className="text-sm text-gray-500 mt-1">
                                                        Expires: {formatDate(profile.license_expiry)}
                                                    </div>
                                                )}
                                            </div>
                                            {(() => {
                                                const days = daysUntil(profile.license_expiry);
                                                if (days === null) {
                                                    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Not set</span>;
                                                } else if (days < 0) {
                                                    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>;
                                                } else if (days <= 30) {
                                                    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Expiring</span>;
                                                } else {
                                                    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Valid</span>;
                                                }
                                            })()}
                                        </div>
                                        <div className="mt-3 pt-3 border-t">
                                            <button
                                                onClick={() => setView('profile')}
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                Update in Profile →
                                            </button>
                                        </div>
                                    </div>

                                    {/* KYC Status */}
                                    <div className="p-4 border rounded-lg bg-gray-50">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-medium text-gray-900">Verification Status</div>
                                                <div className="text-sm text-gray-500 mt-1">
                                                    {profile.kyc_status === 'verified'
                                                        ? 'Your identity has been verified'
                                                        : profile.kyc_status === 'pending_review'
                                                            ? 'Your documents are under review'
                                                            : 'Please submit your verification documents'}
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${profile.kyc_status === 'verified' ? 'bg-green-100 text-green-700' :
                                                profile.kyc_status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {profile.kyc_status === 'verified' ? 'Verified' :
                                                    profile.kyc_status === 'pending_review' ? 'Pending' :
                                                        'Not started'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info Banner */}
                                    {(daysUntil(profile.license_expiry) !== null && daysUntil(profile.license_expiry) < 30) && (
                                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                Please update your license details to remain compliant.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Profile View */}
                    {view === 'profile' && (
                        <ProfileView
                            profile={profile}
                            onUpdate={async (data) => {
                                try {
                                    const result = await employeeApi.updateProfile(data);
                                    setProfile(result.staff);
                                    alert('Profile updated successfully');
                                } catch (err) {
                                    alert(err.message || 'Failed to update profile');
                                }
                            }}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

// Leave View Component
function LeaveView({ leaves, showModal, setShowModal, onSubmit }) {
    const todayISO = new Date().toISOString().slice(0, 10);
    const [formData, setFormData] = useState({
        leave_type: 'sick',
        start_date: todayISO,
        end_date: todayISO,
        reason: ''
    });

    function handleSubmit(e) {
        e.preventDefault();
        if (!formData.start_date || !formData.end_date) {
            alert('Please select start and end dates');
            return;
        }
        onSubmit(formData);
        setFormData({ leave_type: 'sick', start_date: todayISO, end_date: todayISO, reason: '' });
    }

    return (
        <>
            <div className="space-y-4 max-w-2xl">
                {/* Leave Balance Summary */}
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Leave Balance (This Year)</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                        <div>Annual: <span className="font-medium">10 days remaining</span></div>
                        <div>Sick: <span className="font-medium">3 days remaining</span></div>
                    </div>
                </div>

                {/* Leave Requests */}
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">Leave Requests</h2>
                            <p className="text-sm text-gray-500">Your submitted leave requests</p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                        >
                            Request Leave
                        </button>
                    </div>
                    {leaves.length > 0 ? (
                        <div className="space-y-3">
                            {leaves.map(l => {
                                // Simple date formatter
                                const formatLeaveDate = (dateStr) => {
                                    if (!dateStr) return '';
                                    const date = new Date(dateStr + 'T00:00:00');
                                    return date.toLocaleDateString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    });
                                };

                                return (
                                    <div key={l.id} className="p-3 rounded-lg bg-gray-50 border flex items-start justify-between">
                                        <div>
                                            <div className="text-sm font-medium capitalize">{l.leave_type} Leave</div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {formatLeaveDate(l.from_date)} – {formatLeaveDate(l.to_date)}
                                            </div>
                                            {l.reason && <div className="text-xs text-gray-400 mt-1">{l.reason}</div>}
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${l.status === 'approved' ? 'bg-green-100 text-green-700' :
                                            l.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {l.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-gray-500">You haven't submitted any leave requests.</p>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Request Leave</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Leave Type</label>
                                <select
                                    value={formData.leave_type}
                                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                >
                                    <option value="sick">Sick Leave</option>
                                    <option value="annual">Annual Leave</option>
                                    <option value="personal">Personal Leave</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">From</label>
                                <input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">To</label>
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    rows="3"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                                >
                                    Submit Request
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

// Profile View Component
function ProfileView({ profile, onUpdate }) {
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        phone: profile?.phone || '',
        email: profile?.email || '',
        license_type: profile?.license_type || '',
        license_number: profile?.license_number || '',
        license_expiry: profile?.license_expiry || ''
    });

    function handleSubmit(e) {
        e.preventDefault();
        onUpdate(formData);
        setEditMode(false);
    }

    // Title case helper for proper formatting
    function toTitleCase(str) {
        if (!str) return '';
        return str.toLowerCase().split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Format clinic display
    const clinicDisplay = toTitleCase(profile?.clinic_name || '');
    const locationDisplay = toTitleCase(profile?.location_name || '');

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-3xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold">Profile</h2>
                    <p className="text-sm text-gray-500">Your personal and professional information</p>
                </div>
                {!editMode && (
                    <button
                        onClick={() => setEditMode(true)}
                        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                        Edit Profile
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    {/* Personal Information */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Personal Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500">First Name</label>
                                <input
                                    value={toTitleCase(profile?.first_name || '')}
                                    readOnly
                                    className="border p-2 rounded w-full bg-gray-50 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Last Name</label>
                                <input
                                    value={toTitleCase(profile?.last_name || '')}
                                    readOnly
                                    className="border p-2 rounded w-full bg-gray-50 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Phone</label>
                                <input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    readOnly={!editMode}
                                    className={`border p-2 rounded w-full mt-1 ${!editMode ? 'bg-gray-50' : 'bg-white'}`}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Email</label>
                                <input
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    readOnly={!editMode}
                                    className={`border p-2 rounded w-full mt-1 ${!editMode ? 'bg-gray-50' : 'bg-white'}`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Work Information */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Work Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500">Role</label>
                                <input
                                    value={toTitleCase(profile?.job_role || profile?.role || '')}
                                    readOnly
                                    className="border p-2 rounded w-full bg-gray-50 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Clinic</label>
                                <input
                                    value={clinicDisplay + (locationDisplay ? ` • ${locationDisplay}` : '')}
                                    readOnly
                                    className="border p-2 rounded w-full bg-gray-50 mt-1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* License Information */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700">License Information</h3>
                            <span className="text-xs text-gray-400">Managed in My Compliance Docs</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-gray-500">License Type</label>
                                <input
                                    value={formData.license_type.toUpperCase()}
                                    onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                                    readOnly={!editMode}
                                    className={`border p-2 rounded w-full mt-1 ${!editMode ? 'bg-gray-50' : 'bg-white'}`}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">License Number</label>
                                <input
                                    value={formData.license_number}
                                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                                    readOnly={!editMode}
                                    className={`border p-2 rounded w-full mt-1 ${!editMode ? 'bg-gray-50' : 'bg-white'}`}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">License Expiry</label>
                                <input
                                    type="date"
                                    value={formData.license_expiry}
                                    onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                                    readOnly={!editMode}
                                    className={`border p-2 rounded w-full mt-1 ${!editMode ? 'bg-gray-50' : 'bg-white'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {editMode && (
                    <div className="flex gap-2 mt-4">
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Save Changes
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setEditMode(false);
                                setFormData({
                                    phone: profile?.phone || '',
                                    email: profile?.email || '',
                                    license_type: profile?.license_type || '',
                                    license_number: profile?.license_number || '',
                                    license_expiry: profile?.license_expiry || ''
                                });
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
