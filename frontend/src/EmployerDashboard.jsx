import { useState, useEffect, useMemo, useCallback } from 'react';
import { staffAPI, shiftsAPI, attendanceAPI, leaveAPI, locationsAPI, settingsAPI, getClinicId } from './employerApi';

/**
 * HURE Core - Employer Dashboard
 * Multi-tenant clinic management portal
 */

// Clinical job roles
const CLINICAL_ROLES = ['GP', 'Nurse', 'Lab Tech', 'Phlebotomist', 'Radiographer', 'Receptionist'];

// Account roles for RBAC
const ACCOUNT_ROLES = ['admin', 'hr', 'employee'];

// License types (Kenya-specific)
const LICENSE_TYPES = ['KMPDC', 'NCK', 'KMLTTB', 'PPB', 'Other'];

// Leave types
const LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'compassionate', 'other'];

// Permission definitions
const DEFAULT_PERMISSIONS = {
    owner: {
        view_staff: true, create_staff: true, invite_staff: true,
        view_schedule: true, create_shift: true, assign_shift: true,
        view_attendance: true, export_attendance: true,
        view_leave: true, approve_leave: true,
        view_docs: true, upload_docs: true,
        manage_billing: true, manage_permissions: true, view_audit: true
    },
    admin: {
        view_staff: true, create_staff: true, invite_staff: true,
        view_schedule: true, create_shift: true, assign_shift: true,
        view_attendance: true, export_attendance: false,
        view_leave: false, approve_leave: false,
        view_docs: true, upload_docs: false,
        manage_billing: false, manage_permissions: false, view_audit: false
    },
    hr: {
        view_staff: true, create_staff: false, invite_staff: false,
        view_schedule: false, create_shift: false, assign_shift: false,
        view_attendance: true, export_attendance: true,
        view_leave: true, approve_leave: true,
        view_docs: true, upload_docs: true,
        manage_billing: false, manage_permissions: false, view_audit: false
    },
    employee: {
        view_staff: false, create_staff: false, invite_staff: false,
        view_schedule: true, create_shift: false, assign_shift: false,
        view_attendance: true, export_attendance: false,
        view_leave: true, approve_leave: false,
        view_docs: true, upload_docs: false,
        manage_billing: false, manage_permissions: false, view_audit: false
    }
};

export default function EmployerDashboard() {
    // Get clinic ID from localStorage (set after login)
    const clinicId = getClinicId();

    // Current user role (would come from auth context in production)
    const [currentUserRole] = useState('owner');

    // View state
    const [view, setView] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Data states
    const [staff, setStaff] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [attendances, setAttendances] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [locations, setLocations] = useState([]);
    const [clinicInfo, setClinicInfo] = useState({
        name: 'Demo Clinic',
        town: 'Nairobi',
        phone: '+254700000000'
    });

    // Modal states
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showKycModal, setShowKycModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);

    // Form states
    const [newStaff, setNewStaff] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        accountRole: 'employee', jobRole: 'Nurse',
        licenseType: '', licenseNumber: '', licenseExpiry: ''
    });

    const [newShift, setNewShift] = useState({
        date: new Date().toISOString().split('T')[0],
        startTime: '08:00', endTime: '16:00',
        requiredRole: 'Nurse', staffId: null
    });

    // Settings state
    const [clinicSettings, setClinicSettings] = useState({
        clinic: { name: '', town: '', phone: '', contact_name: '' },
        attendance: {
            required_daily_hours: 8,
            unpaid_break_minutes: 30,
            late_threshold_minutes: 15,
            overtime_multiplier: 1.5
        },
        leave: {
            annual_leave_days: 21,
            sick_leave_days: 10,
            maternity_leave_days: 90,
            paternity_leave_days: 14,
            leave_carryover_allowed: false
        }
    });
    const [settingsSaving, setSettingsSaving] = useState(false);

    // Permission check helper
    const hasPermission = useCallback((permission) => {
        return DEFAULT_PERMISSIONS[currentUserRole]?.[permission] ?? false;
    }, [currentUserRole]);

    // Fetch data on mount
    useEffect(() => {
        if (!clinicId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [staffRes, shiftsRes, leaveRes, locationsRes, attendanceRes, settingsRes] = await Promise.all([
                    staffAPI.list(clinicId),
                    shiftsAPI.list(clinicId),
                    leaveAPI.list(clinicId),
                    locationsAPI.list(clinicId),
                    attendanceAPI.list(clinicId),
                    settingsAPI.get(clinicId).catch(() => null) // Don't fail if settings table doesn't exist yet
                ]);

                setStaff(staffRes.data || []);
                setShifts(shiftsRes.data || []);
                setLeaveRequests(leaveRes.data || []);
                setLocations(locationsRes.data || []);
                setAttendances(attendanceRes.data || []);

                // Load clinic settings if available
                if (settingsRes) {
                    setClinicSettings({
                        clinic: settingsRes.clinic || {},
                        attendance: settingsRes.settings?.attendance || clinicSettings.attendance,
                        leave: settingsRes.settings?.leave || clinicSettings.leave
                    });
                    setClinicInfo(settingsRes.clinic || clinicInfo);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clinicId]);

    // Fetch settings when settings view is opened
    useEffect(() => {
        if (view !== 'settings' || !clinicId) return;

        const fetchSettings = async () => {
            try {
                const result = await settingsAPI.get(clinicId);
                setClinicSettings({
                    clinic: result.clinic || {},
                    attendance: result.settings?.attendance || clinicSettings.attendance,
                    leave: result.settings?.leave || clinicSettings.leave
                });
                setClinicInfo(result.clinic || clinicInfo);
            } catch (err) {
                console.error('Failed to load settings:', err);
            }
        };

        fetchSettings();
    }, [view, clinicId]);

    // Save settings handler
    const handleSaveSettings = async () => {
        setSettingsSaving(true);
        try {
            await settingsAPI.update(clinicId, {
                clinic: clinicSettings.clinic,
                attendance: clinicSettings.attendance,
                leave: clinicSettings.leave
            });
            alert('Settings saved successfully!');
        } catch (err) {
            alert('Failed to save settings: ' + err.message);
        } finally {
            setSettingsSaving(false);
        }
    };

    // Staff handlers
    const handleCreateStaff = async () => {
        if (!newStaff.firstName || !newStaff.lastName) {
            alert('First name and last name are required');
            return;
        }

        try {
            const result = await staffAPI.create(clinicId, newStaff);
            setStaff(prev => [...prev, result.data]);
            setShowStaffModal(false);
            setNewStaff({
                firstName: '', lastName: '', email: '', phone: '',
                accountRole: 'employee', jobRole: 'Nurse',
                licenseType: '', licenseNumber: '', licenseExpiry: ''
            });
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSendInvite = async (staffId, method = 'email') => {
        try {
            await staffAPI.sendInvite(clinicId, staffId, method);
            // Refresh staff list
            const result = await staffAPI.list(clinicId);
            setStaff(result.data || []);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleUpdateKyc = async (staffId, status) => {
        try {
            await staffAPI.updateKyc(clinicId, staffId, status);
            const result = await staffAPI.list(clinicId);
            setStaff(result.data || []);
            setShowKycModal(false);
        } catch (err) {
            alert(err.message);
        }
    };

    // Shift handlers
    const handleCreateShift = async () => {
        if (!newShift.date || !newShift.startTime || !newShift.endTime) {
            alert('Date and times are required');
            return;
        }

        try {
            const result = await shiftsAPI.create(clinicId, newShift);
            setShifts(prev => [...prev, result.data]);
            setShowShiftModal(false);
        } catch (err) {
            alert(err.message);
        }
    };

    // Leave handlers
    const handleApproveLeave = async (leaveId) => {
        try {
            await leaveAPI.approve(clinicId, leaveId);
            const result = await leaveAPI.list(clinicId);
            setLeaveRequests(result.data || []);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRejectLeave = async (leaveId) => {
        const reason = prompt('Rejection reason:');
        if (!reason) return;

        try {
            await leaveAPI.reject(clinicId, leaveId, null, reason);
            const result = await leaveAPI.list(clinicId);
            setLeaveRequests(result.data || []);
        } catch (err) {
            alert(err.message);
        }
    };

    // Stats
    const stats = useMemo(() => ({
        totalStaff: staff.length,
        activeStaff: staff.filter(s => s.employment_status === 'active').length,
        openShifts: shifts.filter(s => s.status === 'open').length,
        pendingLeave: leaveRequests.filter(l => l.status === 'pending').length
    }), [staff, shifts, leaveRequests]);

    // Helper functions
    const fullName = (s) => `${s.first_name} ${s.last_name}`;

    const kycStatusLabel = (status) => {
        const labels = {
            verified: 'Verified',
            pending_review: 'Pending Review',
            not_started: 'Not Started',
            rejected: 'Rejected',
            expired: 'Expired'
        };
        return labels[status] || status;
    };

    const kycStatusClass = (status) => {
        const classes = {
            verified: 'bg-green-100 text-green-700',
            pending_review: 'bg-yellow-100 text-yellow-700',
            not_started: 'bg-gray-100 text-gray-600',
            rejected: 'bg-red-100 text-red-700',
            expired: 'bg-orange-100 text-orange-700'
        };
        return classes[status] || 'bg-gray-100 text-gray-600';
    };

    // No clinic ID - show message
    if (!clinicId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold text-gray-800 mb-2">No Clinic Selected</h1>
                    <p className="text-gray-500">Please log in to access the employer portal.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <div className="flex">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0 flex flex-col">
                    <div className="p-4 border-b">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold">
                                HC
                            </div>
                            <div>
                                <div className="text-sm font-semibold">HURE Core</div>
                                <div className="text-xs text-gray-500">Staff Management</div>
                            </div>
                        </div>
                    </div>

                    <nav className="p-4 space-y-1 text-sm flex-1">
                        <div className="text-xs text-gray-400 uppercase mb-2">Main</div>

                        <button
                            onClick={() => setView('dashboard')}
                            className={`block w-full text-left px-3 py-2 rounded-md ${view === 'dashboard' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100'
                                }`}
                        >
                            Dashboard
                        </button>

                        {hasPermission('view_staff') && (
                            <button
                                onClick={() => setView('staff')}
                                className={`block w-full text-left px-3 py-2 rounded-md ${view === 'staff' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100'
                                    }`}
                            >
                                Staff
                            </button>
                        )}

                        {hasPermission('view_schedule') && (
                            <button
                                onClick={() => setView('schedule')}
                                className={`block w-full text-left px-3 py-2 rounded-md ${view === 'schedule' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100'
                                    }`}
                            >
                                Schedule
                            </button>
                        )}

                        {hasPermission('view_attendance') && (
                            <button
                                onClick={() => setView('attendance')}
                                className={`block w-full text-left px-3 py-2 rounded-md ${view === 'attendance' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100'
                                    }`}
                            >
                                Attendance
                            </button>
                        )}

                        {hasPermission('view_leave') && (
                            <button
                                onClick={() => setView('leave')}
                                className={`block w-full text-left px-3 py-2 rounded-md ${view === 'leave' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100'
                                    }`}
                            >
                                Leave Requests
                            </button>
                        )}

                        {hasPermission('manage_billing') && (
                            <button
                                onClick={() => setView('settings')}
                                className={`block w-full text-left px-3 py-2 rounded-md ${view === 'settings' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100'
                                    }`}
                            >
                                Settings
                            </button>
                        )}
                    </nav>

                    {/* Bottom section with Clinic ID and Logout */}
                    <div className="mt-auto">
                        <div className="p-4 border-t">
                            <div className="text-xs text-gray-400 mb-2">Clinic ID</div>
                            <div className="text-xs text-gray-600 font-mono truncate">{clinicId}</div>
                        </div>
                        <div className="p-4 pt-0">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('hure_auth_token');
                                    localStorage.removeItem('hure_clinic_id');
                                    window.location.href = '/';
                                }}
                                className="text-sm text-red-600 hover:text-red-800 hover:underline"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8">
                    {/* Header */}
                    <header className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-semibold">
                                {view === 'dashboard' ? 'Dashboard' : view.charAt(0).toUpperCase() + view.slice(1)}
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Manage your clinic staff, schedules, and operations
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-sm font-medium">{clinicSettings.clinic.name || clinicInfo.name}</div>
                                <div className="text-xs text-gray-500">{clinicSettings.clinic.town || clinicInfo.town}</div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                                {(clinicSettings.clinic.name || clinicInfo.name || 'C').charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </header>

                    {/* Loading/Error States */}
                    {loading && (
                        <div className="text-center py-12">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
                            Error: {error}
                        </div>
                    )}

                    {/* Dashboard View */}
                    {view === 'dashboard' && !loading && (
                        <div>
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">Total Staff</div>
                                    <div className="text-2xl font-semibold mt-2">{stats.totalStaff}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">Active Staff</div>
                                    <div className="text-2xl font-semibold mt-2 text-green-600">{stats.activeStaff}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">Open Shifts</div>
                                    <div className="text-2xl font-semibold mt-2 text-orange-600">{stats.openShifts}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-xs text-gray-400">Pending Leave</div>
                                    <div className="text-2xl font-semibold mt-2 text-blue-600">{stats.pendingLeave}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Recent Staff */}
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <h3 className="text-lg font-semibold mb-3">Recent Staff</h3>
                                    <div className="space-y-2">
                                        {staff.slice(0, 5).map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <div>
                                                    <div className="text-sm font-medium">{fullName(s)}</div>
                                                    <div className="text-xs text-gray-500">{s.job_role}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${kycStatusClass(s.kyc_status)}`}>
                                                    {kycStatusLabel(s.kyc_status)}
                                                </span>
                                            </div>
                                        ))}
                                        {staff.length === 0 && (
                                            <div className="text-sm text-gray-500 text-center py-4">
                                                No staff added yet
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Upcoming Shifts */}
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <h3 className="text-lg font-semibold mb-3">Upcoming Shifts</h3>
                                    <div className="space-y-2">
                                        {shifts.slice(0, 5).map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <div>
                                                    <div className="text-sm font-medium">{s.required_role} - {s.date}</div>
                                                    <div className="text-xs text-gray-500">{s.start_time} - {s.end_time}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${s.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {s.status}
                                                </span>
                                            </div>
                                        ))}
                                        {shifts.length === 0 && (
                                            <div className="text-sm text-gray-500 text-center py-4">
                                                No shifts scheduled
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Staff View */}
                    {view === 'staff' && !loading && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Staff Management</h2>
                                {hasPermission('create_staff') && (
                                    <button
                                        onClick={() => setShowStaffModal(true)}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
                                    >
                                        Add Staff
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-gray-500 border-b">
                                            <th className="py-3 pr-4">Name</th>
                                            <th className="py-3 pr-4">Email</th>
                                            <th className="py-3 pr-4">Role</th>
                                            <th className="py-3 pr-4">Job Role</th>
                                            <th className="py-3 pr-4">KYC Status</th>
                                            <th className="py-3 pr-4">Employment</th>
                                            <th className="py-3 pr-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staff.map(s => (
                                            <tr key={s.id} className="border-b hover:bg-gray-50">
                                                <td className="py-3 pr-4 font-medium">{fullName(s)}</td>
                                                <td className="py-3 pr-4 text-gray-500">{s.email || '-'}</td>
                                                <td className="py-3 pr-4 capitalize">{s.account_role}</td>
                                                <td className="py-3 pr-4">{s.job_role || '-'}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs ${kycStatusClass(s.kyc_status)}`}>
                                                        {kycStatusLabel(s.kyc_status)}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.employment_status === 'active'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {s.employment_status}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => { setSelectedStaff(s); setShowKycModal(true); }}
                                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                        >
                                                            KYC
                                                        </button>
                                                        {hasPermission('invite_staff') && s.invite_status !== 'active' && (
                                                            <button
                                                                onClick={() => handleSendInvite(s.id)}
                                                                className="text-xs text-blue-600 hover:underline"
                                                            >
                                                                Invite
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {staff.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No staff members yet. Click "Add Staff" to get started.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Schedule View */}
                    {view === 'schedule' && !loading && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Schedule</h2>
                                {hasPermission('create_shift') && (
                                    <button
                                        onClick={() => setShowShiftModal(true)}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
                                    >
                                        Create Shift
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {shifts.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                                        <div>
                                            <div className="font-medium">{s.required_role}</div>
                                            <div className="text-sm text-gray-500">
                                                {s.date} · {s.start_time} - {s.end_time}
                                            </div>
                                            {s.staff && (
                                                <div className="text-sm text-emerald-600 mt-1">
                                                    Assigned to: {s.staff.first_name} {s.staff.last_name}
                                                </div>
                                            )}
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs ${s.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                            }`}>
                                            {s.status}
                                        </span>
                                    </div>
                                ))}

                                {shifts.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No shifts scheduled yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Leave View */}
                    {view === 'leave' && !loading && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <h2 className="text-lg font-semibold mb-4">Leave Requests</h2>

                            <div className="space-y-3">
                                {leaveRequests.map(l => (
                                    <div key={l.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                                        <div>
                                            <div className="font-medium">
                                                {l.staff ? `${l.staff.first_name} ${l.staff.last_name}` : 'Unknown'}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {l.leave_type} · {l.from_date} to {l.to_date} ({l.days_count} days)
                                            </div>
                                            {l.reason && (
                                                <div className="text-sm text-gray-400 mt-1">{l.reason}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs ${l.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                l.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {l.status}
                                            </span>

                                            {l.status === 'pending' && hasPermission('approve_leave') && (
                                                <>
                                                    <button
                                                        onClick={() => handleApproveLeave(l.id)}
                                                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectLeave(l.id)}
                                                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {leaveRequests.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No leave requests.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Attendance View */}
                    {view === 'attendance' && !loading && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">Attendance Records</h2>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Status: Present (≥8 hrs) | Half Day (≥4 hrs) | Absent (&lt;4 hrs)
                                    </p>
                                </div>
                                {hasPermission('export_attendance') && (
                                    <button
                                        onClick={() => window.open(`/api/clinics/${clinicId}/attendance/export`, '_blank')}
                                        className="px-4 py-2 bg-white border rounded-md text-sm hover:bg-gray-50"
                                    >
                                        Export CSV
                                    </button>
                                )}
                            </div>

                            {attendances.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-xs text-gray-500 border-b">
                                                <th className="py-3 pr-4">Staff</th>
                                                <th className="py-3 pr-4">Date</th>
                                                <th className="py-3 pr-4">Clock In</th>
                                                <th className="py-3 pr-4">Clock Out</th>
                                                <th className="py-3 pr-4">Hours Worked</th>
                                                <th className="py-3 pr-4">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendances.map(a => {
                                                // Format timestamps to readable time
                                                const formatTime = (timestamp) => {
                                                    if (!timestamp) return '-';
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
                                                    <tr key={a.id} className="border-b hover:bg-gray-50">
                                                        <td className="py-3 pr-4">
                                                            <div className="font-medium">
                                                                {a.staff ? `${a.staff.first_name} ${a.staff.last_name}` : 'Unknown'}
                                                            </div>
                                                            {a.staff?.job_role && (
                                                                <div className="text-xs text-gray-500">{a.staff.job_role}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-3 pr-4">{a.date}</td>
                                                        <td className="py-3 pr-4 text-green-600 font-medium">
                                                            {formatTime(a.clock_in)}
                                                        </td>
                                                        <td className="py-3 pr-4 text-red-600 font-medium">
                                                            {a.clock_out ? formatTime(a.clock_out) : (
                                                                <span className="text-blue-500 italic">Active</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 pr-4">
                                                            {hoursWorked > 0 ? (
                                                                <div>
                                                                    <span className="font-medium">{hoursWorked.toFixed(2)} hrs</span>
                                                                    {overtime > 0 && (
                                                                        <div className="text-xs text-purple-600">
                                                                            +{overtime.toFixed(2)} OT
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 pr-4">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(a.status)}`}>
                                                                {getStatusLabel(a.status)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    No attendance records yet. Staff can clock in/out from the employee portal.
                                </div>
                            )}
                        </div>
                    )}


                    {/* Settings View */}
                    {view === 'settings' && !loading && (
                        <div className="space-y-6">
                            {/* Header with Save Button */}
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Settings</h2>
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={settingsSaving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {settingsSaving ? 'Saving...' : 'Save All Changes'}
                                </button>
                            </div>

                            {/* Clinic Profile Settings */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border">
                                <h3 className="text-md font-semibold mb-4 pb-2 border-b">Clinic Profile</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.clinic.name || ''}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                clinic: { ...clinicSettings.clinic, name: e.target.value }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Town/City</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.clinic.town || ''}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                clinic: { ...clinicSettings.clinic, town: e.target.value }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                        <input
                                            type="tel"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.clinic.phone || ''}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                clinic: { ...clinicSettings.clinic, phone: e.target.value }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.clinic.contact_name || ''}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                clinic: { ...clinicSettings.clinic, contact_name: e.target.value }
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Attendance Settings */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border">
                                <h3 className="text-md font-semibold mb-4 pb-2 border-b">Attendance Settings</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Required Daily Hours</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="1"
                                            max="24"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.attendance.required_daily_hours}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                attendance: { ...clinicSettings.attendance, required_daily_hours: parseFloat(e.target.value) || 8 }
                                            })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Standard workday duration</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Unpaid Break (minutes)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="120"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.attendance.unpaid_break_minutes}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                attendance: { ...clinicSettings.attendance, unpaid_break_minutes: parseInt(e.target.value) || 0 }
                                            })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Lunch/break deduction</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Late Threshold (minutes)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="60"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.attendance.late_threshold_minutes}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                attendance: { ...clinicSettings.attendance, late_threshold_minutes: parseInt(e.target.value) || 0 }
                                            })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Grace period before late</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Multiplier</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="1"
                                            max="3"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.attendance.overtime_multiplier}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                attendance: { ...clinicSettings.attendance, overtime_multiplier: parseFloat(e.target.value) || 1.5 }
                                            })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">OT pay rate (1.5 = 1.5x)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Leave Policy Settings */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border">
                                <h3 className="text-md font-semibold mb-4 pb-2 border-b">Leave Policy</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Annual Leave (days/year)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="60"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.leave.annual_leave_days}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                leave: { ...clinicSettings.leave, annual_leave_days: parseInt(e.target.value) || 0 }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Sick Leave (days/year)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="30"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.leave.sick_leave_days}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                leave: { ...clinicSettings.leave, sick_leave_days: parseInt(e.target.value) || 0 }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Maternity Leave (days)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="180"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.leave.maternity_leave_days}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                leave: { ...clinicSettings.leave, maternity_leave_days: parseInt(e.target.value) || 0 }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Paternity Leave (days)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="30"
                                            className="w-full border rounded-md px-3 py-2"
                                            value={clinicSettings.leave.paternity_leave_days}
                                            onChange={(e) => setClinicSettings({
                                                ...clinicSettings,
                                                leave: { ...clinicSettings.leave, paternity_leave_days: parseInt(e.target.value) || 0 }
                                            })}
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="mr-2 h-4 w-4"
                                                checked={clinicSettings.leave.leave_carryover_allowed}
                                                onChange={(e) => setClinicSettings({
                                                    ...clinicSettings,
                                                    leave: { ...clinicSettings.leave, leave_carryover_allowed: e.target.checked }
                                                })}
                                            />
                                            <span className="text-sm font-medium text-gray-700">Allow Leave Carryover</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Clinic Locations */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border">
                                <h3 className="text-md font-semibold mb-4 pb-2 border-b">Clinic Locations</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {locations.map(loc => (
                                        <div key={loc.id} className="p-4 bg-gray-50 rounded-lg border">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-medium">{loc.name}</div>
                                                    <div className="text-sm text-gray-500">{loc.address || loc.town}</div>
                                                    {loc.phone && <div className="text-sm text-gray-500">{loc.phone}</div>}
                                                </div>
                                                {loc.is_primary && (
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">Primary</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {locations.length === 0 && (
                                        <p className="text-gray-500 text-sm">No locations configured</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* Add Staff Modal */}
            {showStaffModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowStaffModal(false)} />
                    <div className="bg-white rounded-lg p-6 w-96 z-10 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">Add Staff Member</h3>

                        <div className="space-y-3">
                            <input
                                className="w-full border p-2 rounded"
                                placeholder="First Name *"
                                value={newStaff.firstName}
                                onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })}
                            />
                            <input
                                className="w-full border p-2 rounded"
                                placeholder="Last Name *"
                                value={newStaff.lastName}
                                onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
                            />
                            <input
                                className="w-full border p-2 rounded"
                                placeholder="Email"
                                type="email"
                                value={newStaff.email}
                                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                            />
                            <input
                                className="w-full border p-2 rounded"
                                placeholder="Phone"
                                value={newStaff.phone}
                                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                            />

                            <div>
                                <label className="text-xs text-gray-500">Account Role</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newStaff.accountRole}
                                    onChange={(e) => setNewStaff({ ...newStaff, accountRole: e.target.value })}
                                >
                                    {ACCOUNT_ROLES.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500">Job Role</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newStaff.jobRole}
                                    onChange={(e) => setNewStaff({ ...newStaff, jobRole: e.target.value })}
                                >
                                    {CLINICAL_ROLES.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500">License Type</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newStaff.licenseType}
                                    onChange={(e) => setNewStaff({ ...newStaff, licenseType: e.target.value })}
                                >
                                    <option value="">None / Not Applicable</option>
                                    {LICENSE_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <input
                                className="w-full border p-2 rounded"
                                placeholder="License Number"
                                value={newStaff.licenseNumber}
                                onChange={(e) => setNewStaff({ ...newStaff, licenseNumber: e.target.value })}
                            />

                            <div>
                                <label className="text-xs text-gray-500">License Expiry</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    type="date"
                                    value={newStaff.licenseExpiry}
                                    onChange={(e) => setNewStaff({ ...newStaff, licenseExpiry: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowStaffModal(false)}
                                className="px-4 py-2 border rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateStaff}
                                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                                Add Staff
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Shift Modal */}
            {showShiftModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowShiftModal(false)} />
                    <div className="bg-white rounded-lg p-6 w-96 z-10">
                        <h3 className="text-lg font-semibold mb-4">Create Shift</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500">Required Role</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newShift.requiredRole}
                                    onChange={(e) => setNewShift({ ...newShift, requiredRole: e.target.value })}
                                >
                                    {CLINICAL_ROLES.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500">Date</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    type="date"
                                    value={newShift.date}
                                    onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500">Start Time</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        type="time"
                                        value={newShift.startTime}
                                        onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">End Time</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        type="time"
                                        value={newShift.endTime}
                                        onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500">Assign to (optional)</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newShift.staffId || ''}
                                    onChange={(e) => setNewShift({ ...newShift, staffId: e.target.value || null })}
                                >
                                    <option value="">Open Shift</option>
                                    {staff
                                        .filter(s => s.job_role === newShift.requiredRole)
                                        .map(s => (
                                            <option key={s.id} value={s.id}>{fullName(s)}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowShiftModal(false)}
                                className="px-4 py-2 border rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateShift}
                                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                                Create Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* KYC Review Modal */}
            {showKycModal && selectedStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowKycModal(false)} />
                    <div className="bg-white rounded-lg p-6 w-[420px] z-10">
                        <h3 className="text-lg font-semibold mb-2">Review KYC / Credentials</h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Review license details and update verification status.
                        </p>

                        <div className="space-y-3 mb-6">
                            <div className="p-3 bg-gray-50 rounded">
                                <div className="font-medium">{fullName(selectedStaff)}</div>
                                <div className="text-sm text-gray-500">{selectedStaff.job_role}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-gray-500">License Type</div>
                                    <div>{selectedStaff.license_type || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">License Number</div>
                                    <div>{selectedStaff.license_number || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">License Expiry</div>
                                    <div>{selectedStaff.license_expiry || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Current Status</div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${kycStatusClass(selectedStaff.kyc_status)}`}>
                                        {kycStatusLabel(selectedStaff.kyc_status)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <button
                                onClick={() => setShowKycModal(false)}
                                className="px-4 py-2 border rounded hover:bg-gray-50"
                            >
                                Close
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdateKyc(selectedStaff.id, 'pending_review')}
                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                                >
                                    Pending
                                </button>
                                <button
                                    onClick={() => handleUpdateKyc(selectedStaff.id, 'verified')}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                >
                                    Verify
                                </button>
                                <button
                                    onClick={() => handleUpdateKyc(selectedStaff.id, 'rejected')}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
