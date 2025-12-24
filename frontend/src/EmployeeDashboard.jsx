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

    // Computed values
    const fullName = profile ? `${profile.first_name} ${profile.last_name}` : '';
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
        dashboard: `Hi, ${fullName}`,
        schedule: 'My Schedule',
        attendance: 'My Attendance',
        leave: 'My Leave',
        docs: 'Docs & Policies',
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
                {/* Sidebar */}
                <aside className="w-72 bg-white border-r border-gray-200 min-h-screen sticky top-0 flex flex-col">
                    <div className="p-4 border-b">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                                HC
                            </div>
                            <div>
                                <div className="text-sm font-semibold">HURE Core</div>
                                <div className="text-xs text-gray-500">Employee Portal</div>
                            </div>
                        </div>
                    </div>

                    <nav className="p-4 space-y-1 text-sm flex-1">
                        <div className="text-xs text-gray-400 uppercase mb-2">Menu</div>
                        <button
                            onClick={() => setView('dashboard')}
                            className={`block w-full text-left px-3 py-2 rounded-md ${view === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                        >
                            My Dashboard
                        </button>
                        <button
                            onClick={() => setView('schedule')}
                            className={`block w-full text-left px-3 py-2 rounded-md ${view === 'schedule' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                        >
                            My Schedule
                        </button>
                        <button
                            onClick={() => setView('attendance')}
                            className={`block w-full text-left px-3 py-2 rounded-md ${view === 'attendance' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                        >
                            My Attendance
                        </button>
                        <button
                            onClick={() => setView('leave')}
                            className={`block w-full text-left px-3 py-2 rounded-md ${view === 'leave' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                        >
                            My Leave
                        </button>
                        <button
                            onClick={() => setView('docs')}
                            className={`block w-full text-left px-3 py-2 rounded-md ${view === 'docs' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                        >
                            Docs & Policies
                        </button>
                        <button
                            onClick={() => setView('profile')}
                            className={`block w-full text-left px-3 py-2 rounded-md ${view === 'profile' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                        >
                            Profile
                        </button>
                    </nav>

                    <div className="p-4 border-t space-y-2">
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
                                className="w-full text-left px-3 py-2 text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                Switch to Admin View
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                        >
                            Logout
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8">
                    <header className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-semibold">{viewTitle}</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {profile?.clinic_name} · {profile?.location_name}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-sm font-medium">{profile?.role}</div>
                                <div className="text-xs text-gray-500">Employee</div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                {profile?.first_name?.[0] || 'U'}
                            </div>
                        </div>
                    </header>

                    {/* Dashboard View */}
                    {view === 'dashboard' && (
                        <div>
                            {needsReminder && (
                                <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">Action needed</div>
                                        <div className="text-xs">
                                            {licenseExpired && 'License expired · '}
                                            {licenseExpiringSoon && `License expiring in ${licenseDays} days · `}
                                            {profile?.kyc_status !== 'verified' && `Verification status: ${profile?.kyc_status}`}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setView('profile')}
                                        className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs"
                                    >
                                        Update now
                                    </button>
                                </div>
                            )}

                            <section className="grid grid-cols-4 gap-4 mb-6">
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">Employment Status</div>
                                    <div className="mt-2 text-sm font-medium capitalize">
                                        {profile?.employment_status || '—'}
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">Verification</div>
                                    <div className="mt-2 text-sm font-medium capitalize">
                                        {profile?.kyc_status?.replace(/_/g, ' ') || '—'}
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">License</div>
                                    <div className="mt-2 text-sm">{profile?.license_type || '—'}</div>
                                    <div className="text-xs text-gray-500">{profile?.license_number || '—'}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">License Expiry</div>
                                    <div className={`mt-2 text-sm ${licenseExpired ? 'text-red-600' : licenseExpiringSoon ? 'text-amber-600' : ''}`}>
                                        {profile?.license_expiry || '—'}
                                    </div>
                                    {licenseExpired && <div className="text-xs text-red-600">Expired</div>}
                                    {licenseExpiringSoon && <div className="text-xs text-amber-600">{licenseDays} days left</div>}
                                </div>
                            </section>

                            <div className="grid grid-cols-3 gap-6">
                                <div className="col-span-2 bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-lg font-semibold">Upcoming Shifts</h2>
                                        {nextShift && (
                                            <div className="text-xs text-gray-500">
                                                Next: {nextShift.date} {nextShift.start_time}–{nextShift.end_time}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        {schedule.filter(s => s.date >= todayISO).slice(0, 5).map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-3 rounded-md bg-gray-50 border">
                                                <div>
                                                    <div className="text-sm font-medium">
                                                        {s.date} · {s.start_time}–{s.end_time} · {s.role}
                                                    </div>
                                                    <div className="text-xs text-gray-500 capitalize">{s.status}</div>
                                                    {s.decline_reason && (
                                                        <div className="text-xs text-red-500">Declined: {s.decline_reason}</div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {s.status === 'assigned' && (
                                                        <>
                                                            <button
                                                                onClick={() => confirmShift(s.id)}
                                                                className="text-xs border rounded px-2 py-1 hover:bg-gray-100"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => declineShift(s.id)}
                                                                className="text-xs border rounded px-2 py-1 text-red-600 hover:bg-red-50"
                                                            >
                                                                Decline
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {schedule.filter(s => s.date >= todayISO).length === 0 && (
                                            <p className="text-gray-500 text-sm">No upcoming shifts</p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                                    <div className="space-y-2">
                                        <button
                                            onClick={activePunch ? handleClockOut : handleClockIn}
                                            className="w-full px-3 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                                        >
                                            {activePunch ? 'Clock Out' : 'Clock In'}
                                        </button>
                                        <div className="text-xs text-gray-500">
                                            {activePunch
                                                ? `Clocked in today at ${activePunch.in}`
                                                : todayShift
                                                    ? `Scheduled today: ${todayShift.start_time}–${todayShift.end_time}`
                                                    : 'No active clock-in.'}
                                        </div>
                                        <button
                                            onClick={() => setView('attendance')}
                                            className="w-full px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                        >
                                            View My Attendance
                                        </button>
                                        <button
                                            onClick={() => setView('leave')}
                                            className="w-full px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                        >
                                            Request Leave
                                        </button>
                                        <button
                                            onClick={() => setView('profile')}
                                            className="w-full px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                        >
                                            Update Profile
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Schedule View */}
                    {view === 'schedule' && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-semibold">My Schedule</h2>
                                <div className="text-sm text-gray-500">Assigned & available shifts</div>
                            </div>
                            <div className="space-y-3">
                                {schedule.map(s => (
                                    <div key={s.id} className={`flex items-center justify-between p-3 rounded-md border ${s.isOpenShift ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                                        <div>
                                            <div className="text-sm font-medium">
                                                {s.date} · {s.start_time}–{s.end_time} · {s.role}
                                                {s.isOpenShift && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                                        Open Shift
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 capitalize">{s.status}</div>
                                            {s.decline_reason && (
                                                <div className="text-xs text-red-500">Declined: {s.decline_reason}</div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {s.status === 'assigned' && (
                                                <>
                                                    <button
                                                        onClick={() => confirmShift(s.id)}
                                                        className="text-xs border rounded px-2 py-1 hover:bg-gray-100"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => declineShift(s.id)}
                                                        className="text-xs border rounded px-2 py-1 text-red-600 hover:bg-red-50"
                                                    >
                                                        Decline
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {schedule.length === 0 && (
                                    <p className="text-gray-500 text-sm">No shifts scheduled</p>
                                )}
                            </div>
                        </div>
                    )}


                    {/* Attendance View */}
                    {view === 'attendance' && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-4xl">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-lg font-semibold">My Attendance</h2>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Present (≥8 hrs) | Half Day (≥4 hrs) | Absent (&lt;4 hrs)
                                    </p>
                                </div>
                                <button
                                    onClick={exportAttendance}
                                    className="px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                                >
                                    Export CSV
                                </button>
                            </div>
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
                                        const formatTime = (timestamp) => {
                                            if (!timestamp) return '—';
                                            const date = new Date(timestamp);
                                            return date.toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: true
                                            });
                                        };

                                        // Calculate overtime
                                        const hoursWorked = a.hours_worked || 0;
                                        const overtime = hoursWorked > 8 ? hoursWorked - 8 : 0;

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
                                                default: return 'Clocked In';
                                            }
                                        };

                                        return (
                                            <tr key={a.id} className="border-b">
                                                <td className="py-2">{a.date}</td>
                                                <td className="py-2 text-green-600 font-medium">
                                                    {formatTime(a.clock_in)}
                                                </td>
                                                <td className="py-2 text-red-600 font-medium">
                                                    {a.clock_out ? formatTime(a.clock_out) : (
                                                        <span className="text-blue-500 italic">Active</span>
                                                    )}
                                                </td>
                                                <td className="py-2">
                                                    {hoursWorked > 0 ? (
                                                        <div>
                                                            <span className="font-medium">{hoursWorked.toFixed(2)} hrs</span>
                                                            {overtime > 0 && (
                                                                <span className="text-xs text-purple-600 ml-1">
                                                                    +{overtime.toFixed(2)} OT
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
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
                            {attendance.length === 0 && (
                                <p className="text-gray-500 text-sm mt-4">No attendance records</p>
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
                            <h2 className="text-lg font-semibold mb-3">Docs & Policies</h2>
                            <ul className="space-y-2">
                                {documents.map(d => (
                                    <li key={d.id} className="p-2 border rounded flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{d.title}</div>
                                            <div className="text-xs text-gray-500">
                                                {d.document_type} · Uploaded {d.uploaded_at?.slice(0, 10)}
                                            </div>
                                            {d.acknowledged && d.acknowledged_at && (
                                                <div className="text-xs text-green-700">
                                                    Acknowledged on {d.acknowledged_at.slice(0, 10)}
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
                                                    className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                                                >
                                                    Acknowledge
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {documents.length === 0 && (
                                    <p className="text-gray-500 text-sm">No documents available</p>
                                )}
                            </ul>
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
            <div className="bg-white p-4 rounded-lg shadow-sm border max-w-2xl">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">My Leave</h2>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                        Request Leave
                    </button>
                </div>
                <div className="space-y-3">
                    {leaves.map(l => (
                        <div key={l.id} className="p-3 rounded-md bg-gray-50 border flex items-start justify-between">
                            <div>
                                <div className="text-sm font-medium capitalize">{l.leave_type}</div>
                                <div className="text-xs text-gray-500">
                                    {l.from_date} to {l.to_date}
                                </div>
                                {l.reason && <div className="text-xs mt-1">{l.reason}</div>}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${l.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    l.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                }`}>
                                {l.status}
                            </span>
                        </div>
                    ))}
                    {leaves.length === 0 && (
                        <p className="text-gray-500 text-sm">No leave requests</p>
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

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-3xl">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Profile</h2>
                {!editMode && (
                    <button
                        onClick={() => setEditMode(true)}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                        Edit
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-600">First Name</label>
                        <input
                            value={profile?.first_name || ''}
                            readOnly
                            className="border p-2 rounded w-full bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Last Name</label>
                        <input
                            value={profile?.last_name || ''}
                            readOnly
                            className="border p-2 rounded w-full bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Role</label>
                        <input
                            value={profile?.role || ''}
                            readOnly
                            className="border p-2 rounded w-full bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Clinic</label>
                        <input
                            value={`${profile?.clinic_name || ''} (${profile?.location_name || ''})`}
                            readOnly
                            className="border p-2 rounded w-full bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Phone</label>
                        <input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            readOnly={!editMode}
                            className={`border p-2 rounded w-full ${!editMode ? 'bg-gray-50' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">Email</label>
                        <input
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            readOnly={!editMode}
                            className={`border p-2 rounded w-full ${!editMode ? 'bg-gray-50' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">License Type</label>
                        <input
                            value={formData.license_type}
                            onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                            readOnly={!editMode}
                            className={`border p-2 rounded w-full ${!editMode ? 'bg-gray-50' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">License Number</label>
                        <input
                            value={formData.license_number}
                            onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                            readOnly={!editMode}
                            className={`border p-2 rounded w-full ${!editMode ? 'bg-gray-50' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600">License Expiry</label>
                        <input
                            type="date"
                            value={formData.license_expiry}
                            onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                            readOnly={!editMode}
                            className={`border p-2 rounded w-full ${!editMode ? 'bg-gray-50' : ''}`}
                        />
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
