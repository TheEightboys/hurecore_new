import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    staffAPI, shiftsAPI, attendanceAPI, leaveAPI, locationsAPI, settingsAPI,
    scheduleBlocksAPI, payrollAPI, verificationAPI, auditAPI, getClinicId
} from './employerApi';

/**
 * HURE Core - Employer Dashboard (Redesigned)
 * Multi-location organization model with coverage-first scheduling
 */

// ============================================
// CONSTANTS
// ============================================

const CLINICAL_ROLES = ['GP', 'Nurse', 'Clinical Officer', 'Lab Tech', 'Pharmacist', 'Receptionist'];
const LICENSE_TYPES = ['KMPDC', 'NCK', 'KMLTTB', 'PPB', 'Other'];
const LICENSING_BODIES = ['KMPDC', 'NCK', 'PPB', 'COC', 'OTHER'];

const PLAN_LIMITS = {
    essential: { locations: 1, staff: 10, adminPerms: 0 },
    professional: { locations: 2, staff: 30, adminPerms: 2 },
    enterprise: { locations: 5, staff: 50, adminPerms: 10 }
};

const DEFAULT_PERMISSIONS = {
    owner: ['view_dashboard', 'view_staff', 'manage_staff', 'view_schedule', 'manage_schedule',
        'view_attendance', 'export_payroll', 'view_leave', 'manage_leave', 'view_billing',
        'manage_org_settings', 'manage_location_settings', 'manage_org_verification',
        'manage_facility_verification', 'view_docs', 'manage_docs', 'view_audit'],
    admin: ['view_dashboard', 'view_staff', 'manage_staff', 'view_schedule', 'manage_schedule',
        'view_attendance', 'export_payroll', 'view_leave', 'manage_leave', 'manage_location_settings',
        'manage_facility_verification', 'view_docs', 'manage_docs', 'view_audit'],
    hr: ['view_dashboard', 'view_staff', 'manage_staff', 'view_schedule', 'view_attendance',
        'export_payroll', 'view_leave', 'manage_leave', 'view_docs', 'manage_docs', 'view_audit'],
    employee: ['view_dashboard', 'view_staff', 'view_schedule', 'view_attendance', 'view_leave', 'view_docs']
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

const fmtDateEA = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const fmtKES = (n) => Number(n || 0).toLocaleString('en-KE');

const statusPillClass = (status) => {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
    switch ((status || '').toUpperCase().replace(/_/g, ' ')) {
        case 'ACTIVE': case 'APPROVED': case 'VERIFIED': case 'COMPLETED':
            return `${base} bg-emerald-100 text-emerald-800`;
        case 'PENDING': case 'PENDING REVIEW': case 'UNDER REVIEW': case 'IN PROGRESS':
            return `${base} bg-amber-100 text-amber-800`;
        case 'REJECTED': case 'SUSPENDED':
            return `${base} bg-rose-100 text-rose-800`;
        case 'EXPIRED':
            return `${base} bg-slate-200 text-slate-700`;
        case 'DRAFT': case 'NOT STARTED':
            return `${base} bg-slate-100 text-slate-700`;
        default:
            return `${base} bg-slate-100 text-slate-700`;
    }
};
// ============================================
// SHARED COMPONENTS - Enhanced
// ============================================

const Card = ({ title, right, children, className = '' }) => (
    <div className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 p-6 ${className}`}>
        {(title || right) && (
            <div className="flex items-start justify-between gap-4 mb-4">
                {title && <div className="font-semibold text-lg text-slate-800">{title}</div>}
                {right}
            </div>
        )}
        {children}
    </div>
);

const Modal = ({ title, children, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="text-xl font-bold text-slate-800">{title}</div>
                <button className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors" onClick={onClose}>
                    ✕ Close
                </button>
            </div>
            {children}
        </div>
    </div>
);

const Field = ({ label, children }) => (
    <label className="block">
        <div className="text-sm font-medium text-slate-600 mb-2">{label}</div>
        {children}
    </label>
);

const TabBtn = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${active
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
    >
        {label}
    </button>
);

const NavBtn = ({ label, active, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-all flex items-center ${active
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20'
            : 'hover:bg-slate-700/50 text-white hover:text-white'
            }`}
    >
        {icon && <span className="mr-2">{icon}</span>}
        <span className="text-sm">{label}</span>
    </button>
);

// Standalone AddStaffModal component to prevent input focus loss
const AddStaffModal = ({ isOpen, onClose, onSave, clinicId, currentLoc }) => {
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '',
        accountRole: 'employee', jobRole: 'Nurse',
        licenseType: '', licenseNumber: '', licenseExpiry: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!formData.firstName || !formData.lastName) {
            alert('First name and last name are required');
            return;
        }
        await onSave({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            accountRole: formData.accountRole,
            jobRole: formData.jobRole,
            licenseType: formData.licenseType,
            licenseNumber: formData.licenseNumber,
            licenseExpiry: formData.licenseExpiry,
            locationId: currentLoc !== 'ALL' ? currentLoc : null
        });
        setFormData({ firstName: '', lastName: '', email: '', accountRole: 'employee', jobRole: 'Nurse', licenseType: '', licenseNumber: '', licenseExpiry: '' });
    };

    return (
        <Modal title="Add staff" onClose={onClose}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="First name">
                    <input
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.firstName}
                        onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        autoFocus
                    />
                </Field>
                <Field label="Last name">
                    <input
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.lastName}
                        onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                </Field>
                <Field label="Email">
                    <input
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.email}
                        onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                </Field>
                <Field label="Account role">
                    <select
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.accountRole}
                        onChange={e => setFormData(prev => ({ ...prev, accountRole: e.target.value }))}
                    >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                    </select>
                </Field>
                <Field label="Job role">
                    <select
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.jobRole}
                        onChange={e => setFormData(prev => ({ ...prev, jobRole: e.target.value }))}
                    >
                        {CLINICAL_ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                </Field>
                <Field label="License type">
                    <select
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.licenseType}
                        onChange={e => setFormData(prev => ({ ...prev, licenseType: e.target.value }))}
                    >
                        <option value="">Select license type</option>
                        {LICENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                </Field>
                <Field label="License number">
                    <input
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.licenseNumber}
                        onChange={e => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                        placeholder="e.g. 12345"
                    />
                </Field>
                <Field label="License expiry">
                    <input
                        type="date"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                        value={formData.licenseExpiry}
                        onChange={e => setFormData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                    />
                </Field>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 rounded-xl border border-slate-300 text-sm" onClick={onClose}>Cancel</button>
                <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm" onClick={handleSubmit}>Save</button>
            </div>
        </Modal>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function EmployerDashboard() {
    const clinicId = getClinicId();

    // View state
    const [view, setView] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Location state
    const [currentLoc, setCurrentLoc] = useState('ALL');
    const [locations, setLocations] = useState([]);

    // Organization state
    const [org, setOrg] = useState({
        name: 'Demo Health Group',
        plan: { tier: 'professional', status: 'active', renewOn: '2026-01-15' },
        billing: { currency: 'KES', lastInvoiceId: 'INV-1002' },
        orgVerification: { status: 'pending_review', kraPin: '', businessRegNo: '' }
    });

    // Data states
    const [staff, setStaff] = useState([]);
    const [scheduleBlocks, setScheduleBlocks] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [audit, setAudit] = useState([]);
    const [docs, setDocs] = useState([]);

    // Payroll status tracking
    const [payrollStatusMap, setPayrollStatusMap] = useState({});

    // User role and permissions
    const [currentUserRole] = useState('owner');
    const permissions = DEFAULT_PERMISSIONS[currentUserRole] || [];
    const has = useCallback((p) => permissions.includes(p), [permissions]);

    // Modal states
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState(false);

    // Form states
    const [newStaff, setNewStaff] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        accountRole: 'employee', jobRole: 'Nurse',
        licenseType: '', licenseNumber: '', licenseExpiry: '',
        payBasis: 'MONTHLY', monthlySalaryKes: 60000, dailyRateKes: 4500
    });

    const [newShift, setNewShift] = useState({
        date: '', start: '08:00', end: '17:00', roleNeeded: 'Nurse', qtyNeeded: 1
    });

    // Computed values
    const locMap = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
    const currentLocName = useMemo(() =>
        currentLoc === 'ALL' ? 'All Locations' : (locMap[currentLoc]?.name || 'Unknown'),
        [currentLoc, locMap]);

    const limits = useMemo(() => PLAN_LIMITS[org.plan.tier] || PLAN_LIMITS.essential, [org.plan.tier]);

    // Scoped data helpers
    const scoped = useCallback((arr) =>
        currentLoc === 'ALL' ? arr : arr.filter(x => x.location_id === currentLoc),
        [currentLoc]);

    const staffScoped = useMemo(() => scoped(staff), [staff, scoped]);
    const scheduleBlocksScoped = useMemo(() => scoped(scheduleBlocks), [scheduleBlocks, scoped]);
    const attendanceScoped = useMemo(() => scoped(attendance), [attendance, scoped]);
    const leavesScoped = useMemo(() => scoped(leaves), [leaves, scoped]);

    // ============================================
    // DATA FETCHING
    // ============================================

    useEffect(() => {
        if (!clinicId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [staffRes, locRes, blocksRes, attRes, leaveRes, orgVerRes, settingsRes] = await Promise.all([
                    staffAPI.list(clinicId).catch(() => ({ data: [] })),
                    locationsAPI.list(clinicId).catch(() => ({ data: [] })),
                    scheduleBlocksAPI.list(clinicId).catch(() => ({ data: [] })),
                    attendanceAPI.list(clinicId).catch(() => ({ data: [] })),
                    leaveAPI.list(clinicId).catch(() => ({ data: [] })),
                    verificationAPI.getOrg(clinicId).catch(() => ({ data: null })),
                    settingsAPI.get(clinicId).catch(() => ({ clinic: null }))
                ]);

                setStaff(staffRes.data || []);
                setLocations(locRes.data || []);
                setScheduleBlocks(blocksRes.data || []);
                setAttendance(attRes.data || []);
                setLeaves(leaveRes.data || []);

                // Update org with clinic name from settings
                if (settingsRes.clinic?.name) {
                    setOrg(prev => ({
                        ...prev,
                        name: settingsRes.clinic.name
                    }));
                }

                // Update org with verification data if available
                if (orgVerRes.data) {
                    setOrg(prev => ({
                        ...prev,
                        kra_pin: orgVerRes.data.kra_pin || '',
                        business_reg_no: orgVerRes.data.business_reg_no || '',
                        org_verification_status: orgVerRes.data.org_verification_status || 'draft'
                    }));
                }
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clinicId]);

    // Add audit entry helper
    const addAudit = useCallback((actor, action, detail = '') => {
        const entry = { id: uid('au'), created_at: new Date().toISOString(), actor_name: actor, type: action, detail, location_id: currentLoc };
        setAudit(prev => [entry, ...prev]);
        auditAPI.add(clinicId, entry).catch(console.error);
    }, [clinicId, currentLoc]);

    // No clinic - show message
    if (!clinicId) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold text-slate-800 mb-2">No Clinic Selected</h1>
                    <p className="text-slate-500">Please log in to access the employer portal.</p>
                </div>
            </div>
        );
    }

    // ============================================
    // TOP BAR
    // ============================================

    const TopBar = () => (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">H</div>
                    <div>
                        <div className="text-sm font-semibold">{org.name}</div>
                        <div className="text-xs text-slate-600">
                            Plan: <span className="font-medium">{org.plan.tier}</span>{' '}
                            <span className={statusPillClass(org.plan.status)}>{org.plan.status}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden sm:block text-xs text-slate-600 mr-2">Viewing</div>
                    <select
                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                        value={currentLoc}
                        onChange={(e) => setCurrentLoc(e.target.value)}
                    >
                        <option value="ALL">All Locations</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>

                    <button
                        onClick={() => { localStorage.removeItem('hure_auth_token'); localStorage.removeItem('hure_clinic_id'); window.location.href = '/'; }}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-50"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );

    // ============================================
    // SIDEBAR - Enhanced
    // ============================================

    const Sidebar = () => (
        <div className="bg-gradient-to-b from-slate-900 to-slate-800 px-3 pt-5 pb-3 w-56 min-h-[calc(100vh-53px)] sticky top-0 flex flex-col shrink-0">
            {/* User Info */}
            <div className="mb-3 pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                        {currentUserRole.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-white">{currentUserRole}</div>
                        <div className="text-xs text-slate-300">{currentLocName}</div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-0.5 flex-1">
                {has('view_dashboard') && <NavBtn icon="📊" label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />}
                {has('view_staff') && <NavBtn icon="👥" label="Staff" active={view === 'staff'} onClick={() => setView('staff')} />}
                {has('view_schedule') && <NavBtn icon="📅" label="Schedule" active={view === 'schedule'} onClick={() => setView('schedule')} />}
                {has('view_attendance') && <NavBtn icon="⏰" label="Attendance" active={view === 'attendance'} onClick={() => setView('attendance')} />}
                {has('export_payroll') && <NavBtn icon="💰" label="Payroll" active={view === 'payroll'} onClick={() => setView('payroll')} />}
                {has('view_leave') && <NavBtn icon="🏖️" label="Leave" active={view === 'leave'} onClick={() => setView('leave')} />}
                {(has('manage_org_verification') || has('manage_facility_verification')) &&
                    <NavBtn icon="✅" label="Verification" active={view === 'verification'} onClick={() => setView('verification')} />}
                {(has('manage_org_settings') || has('manage_location_settings')) &&
                    <NavBtn icon="⚙️" label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />}
                {has('view_billing') && <NavBtn icon="💳" label="Billing" active={view === 'billing'} onClick={() => setView('billing')} />}
                {has('view_docs') && <NavBtn icon="📄" label="Documents" active={view === 'docs'} onClick={() => setView('docs')} />}
                {has('view_audit') && <NavBtn icon="📝" label="Audit Log" active={view === 'audit'} onClick={() => setView('audit')} />}
            </nav>
        </div>
    );

    // ============================================
    // DASHBOARD VIEW
    // ============================================

    const DashboardView = () => {
        const openShifts = scheduleBlocksScoped.filter(b => {
            const asg = (b.assigned_staff_ids || []).length + (b.external_covers || []).length;
            return asg < (b.qty_needed || 1);
        }).length;

        const facilityPending = locations.filter(l => l.facility_verification_status !== 'approved').length;

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <div className="text-xl font-bold">Dashboard</div>
                        <div className="text-sm text-slate-600 mt-1">Overview • {currentLocName}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card title="Subscription">
                        <div className="text-sm text-slate-700">Tier: <span className="font-semibold">{org.plan.tier}</span></div>
                        <div className="text-sm text-slate-700 mt-1">Renewal: <span className="font-medium">{fmtDateEA(org.plan.renewOn)}</span></div>
                        <div className="text-sm text-slate-700 mt-2">
                            Limits: <span className="font-medium">{limits.locations} location(s)</span>, <span className="font-medium">{limits.staff} staff</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                            {locations.length > limits.locations ? '⚠️ Above location limit' : '✓ Within plan limits'}
                        </div>
                    </Card>

                    <Card title="Verification status">
                        <div className="flex items-center justify-between text-sm">
                            <div className="text-slate-700">Organization</div>
                            <span className={statusPillClass(org.orgVerification.status)}>{org.orgVerification.status.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                            <div className="text-slate-700">Facilities needing action</div>
                            <div className="font-semibold">{facilityPending}</div>
                        </div>
                    </Card>

                    <Card title="Operational snapshot">
                        <div className="text-sm text-slate-700">Locations: <span className="font-semibold">{locations.length}</span></div>
                        <div className="text-sm text-slate-700 mt-1">Staff: <span className="font-semibold">{staff.length}</span></div>
                        <div className="text-sm text-slate-700 mt-1">Coverage gaps: <span className="font-semibold">{openShifts}</span></div>
                    </Card>
                </div>
            </div>
        );
    };

    // ============================================
    // STAFF VIEW (Simplified)
    // ============================================

    const StaffView = () => {
        const canManage = has('manage_staff');
        const [reviewStaff, setReviewStaff] = useState(null);

        const updateVettingStatus = async (staffId, status) => {
            try {
                await staffAPI.updateKyc(clinicId, staffId, status);
                const res = await staffAPI.list(clinicId);
                setStaff(res.data || []);
                setReviewStaff(null);
                addAudit('Owner', 'Updated vetting', `Status changed to ${status}`);
            } catch (err) { alert(err.message); }
        };

        const updateEmploymentStatus = async (staffId, status) => {
            try {
                await staffAPI.update(clinicId, staffId, { employmentStatus: status });
                const res = await staffAPI.list(clinicId);
                setStaff(res.data || []);
                addAudit('Owner', 'Updated status', `Status changed to ${status}`);
            } catch (err) { alert(err.message); }
        };

        const [inviteStaff, setInviteStaff] = useState(null);
        const [inviteSending, setInviteSending] = useState(false);

        const sendInvite = async (staffMember, method = 'email') => {
            setInviteSending(true);
            try {
                const result = await staffAPI.sendInvite(clinicId, staffMember.id, method);
                alert(`Invite sent successfully via ${method}!`);
                const res = await staffAPI.list(clinicId);
                setStaff(res.data || []);
                setInviteStaff(null);
                addAudit('Owner', 'Sent invite', `${staffMember.first_name} ${staffMember.last_name} via ${method}`);
            } catch (err) {
                alert(`Failed to send invite: ${err.message}`);
            } finally {
                setInviteSending(false);
            }
        };

        const [editStaff, setEditStaff] = useState(null);
        const [editForm, setEditForm] = useState({});

        // When editStaff changes, populate editForm
        useEffect(() => {
            if (editStaff) {
                setEditForm({
                    firstName: editStaff.first_name || '',
                    lastName: editStaff.last_name || '',
                    email: editStaff.email || '',
                    accountRole: editStaff.account_role || 'employee',
                    jobRole: editStaff.job_role || '',
                    licenseType: editStaff.license_type || '',
                    licenseNumber: editStaff.license_number || '',
                    licenseExpiry: editStaff.license_expiry || ''
                });
            }
        }, [editStaff]);

        const saveStaffEdit = async () => {
            try {
                await staffAPI.update(clinicId, editStaff.id, editForm);
                const res = await staffAPI.list(clinicId);
                setStaff(res.data || []);
                setEditStaff(null);
                addAudit('Owner', 'Updated staff', `${editForm.firstName} ${editForm.lastName}`);
            } catch (err) { alert(err.message); }
        };

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <div className="text-xl font-bold">Staff</div>
                        <div className="text-sm text-slate-600 mt-1">Manage staff • {currentLocName}</div>
                    </div>
                    {canManage && (
                        <button onClick={() => setShowStaffModal(true)} className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">
                            Add staff
                        </button>
                    )}
                </div>

                <Card>
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="text-left font-medium p-3">Name</th>
                                    <th className="text-left font-medium p-3">Email</th>
                                    <th className="text-left font-medium p-3">Role</th>
                                    <th className="text-left font-medium p-3">Job Role</th>
                                    <th className="text-left font-medium p-3">Vetting</th>
                                    <th className="text-left font-medium p-3">Status</th>
                                    {canManage && <th className="text-left font-medium p-3">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {staffScoped.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/60">
                                        <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                                        <td className="p-3 text-slate-700">{s.email || '—'}</td>
                                        <td className="p-3 capitalize">{s.account_role || '—'}</td>
                                        <td className="p-3">{s.job_role || '—'}</td>
                                        <td className="p-3"><span className={statusPillClass(s.vetting_status || s.kyc_status)}>{s.vetting_status || s.kyc_status || 'not_started'}</span></td>
                                        <td className="p-3"><span className={statusPillClass(s.employment_status)}>{s.employment_status || 'inactive'}</span></td>
                                        {canManage && (
                                            <td className="p-3">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setEditStaff(s)}
                                                        className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => setReviewStaff(s)}
                                                        className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                                    >
                                                        Review
                                                    </button>
                                                    {/* Invite button - show if not yet accepted */}
                                                    {s.invite_status !== 'accepted' && s.email && (
                                                        <button
                                                            onClick={() => setInviteStaff(s)}
                                                            className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                                        >
                                                            {s.invite_status === 'pending' ? 'Resend' : 'Invite'}
                                                        </button>
                                                    )}
                                                    {s.invite_status === 'pending' && s.employment_status === 'active' && (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await staffAPI.update(clinicId, s.id, { inviteStatus: 'accepted' });
                                                                    const res = await staffAPI.list(clinicId);
                                                                    setStaff(res.data || []);
                                                                } catch (err) { alert(err.message); }
                                                            }}
                                                            className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                            title="Mark as joined if employee has already joined"
                                                        >
                                                            Mark Joined
                                                        </button>
                                                    )}
                                                    {s.invite_status === 'pending' && s.employment_status !== 'active' && (
                                                        <span className="px-2 py-1 text-xs text-amber-600">Pending</span>
                                                    )}
                                                    {s.invite_status === 'accepted' && (
                                                        <span className="px-2 py-1 text-xs text-emerald-600">✓ Joined</span>
                                                    )}
                                                    {s.employment_status !== 'active' && (
                                                        <button
                                                            onClick={() => updateEmploymentStatus(s.id, 'active')}
                                                            className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                        >
                                                            Activate
                                                        </button>
                                                    )}
                                                    {s.employment_status === 'active' && (
                                                        <button
                                                            onClick={() => updateEmploymentStatus(s.id, 'inactive')}
                                                            className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                                                        >
                                                            Deactivate
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {staffScoped.length === 0 && (
                                    <tr><td className="p-4 text-slate-500" colSpan={canManage ? 7 : 6}>No staff in this scope.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <AddStaffModal
                    isOpen={showStaffModal}
                    onClose={() => setShowStaffModal(false)}
                    clinicId={clinicId}
                    currentLoc={currentLoc}
                    onSave={async (data) => {
                        try {
                            await staffAPI.create(clinicId, data);
                            const res = await staffAPI.list(clinicId);
                            setStaff(res.data || []);
                            setShowStaffModal(false);
                            addAudit('Owner', 'Added staff', `${data.firstName} ${data.lastName} (${data.accountRole})`);
                        } catch (err) { alert(err.message); }
                    }}
                />

                {/* Vetting Review Modal */}
                {reviewStaff && (
                    <Modal title="Review Vetting / Credentials" onClose={() => setReviewStaff(null)}>
                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-sm font-medium">{reviewStaff.first_name} {reviewStaff.last_name}</div>
                                <div className="text-xs text-slate-600">{reviewStaff.email} • {reviewStaff.job_role}</div>
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-2">Current Vetting Status</div>
                                <span className={statusPillClass(reviewStaff.vetting_status || reviewStaff.kyc_status)}>
                                    {reviewStaff.vetting_status || reviewStaff.kyc_status || 'not_started'}
                                </span>
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-2">License Details</div>
                                <div className="text-sm text-slate-600">
                                    Type: {reviewStaff.license_type || 'Not provided'}<br />
                                    Number: {reviewStaff.license_number || 'Not provided'}<br />
                                    Expiry: {reviewStaff.license_expiry || 'Not provided'}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-2">Update Vetting Status</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => updateVettingStatus(reviewStaff.id, 'pending_review')}
                                        className="px-3 py-2 text-sm rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200"
                                    >
                                        Pending Review
                                    </button>
                                    <button
                                        onClick={() => updateVettingStatus(reviewStaff.id, 'verified')}
                                        className="px-3 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        ✓ Approve / Verify
                                    </button>
                                    <button
                                        onClick={() => updateVettingStatus(reviewStaff.id, 'rejected')}
                                        className="px-3 py-2 text-sm rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Send Invite Modal */}
                {inviteStaff && (
                    <Modal title="Send Invitation" onClose={() => setInviteStaff(null)}>
                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-sm font-medium">{inviteStaff.first_name} {inviteStaff.last_name}</div>
                                <div className="text-xs text-slate-600">{inviteStaff.email} • {inviteStaff.job_role}</div>
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-2">Current Invite Status</div>
                                <span className={statusPillClass(inviteStaff.invite_status || 'none')}>
                                    {inviteStaff.invite_status || 'Not invited'}
                                </span>
                                {inviteStaff.invite_sent_at && (
                                    <div className="text-xs text-slate-500 mt-1">
                                        Last sent: {new Date(inviteStaff.invite_sent_at).toLocaleString()}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-2">Send Invitation via</div>
                                <div className="text-xs text-slate-500 mb-3">
                                    An invitation email will be sent to <strong>{inviteStaff.email}</strong>.
                                    The employee can use the link to set their password and access the Employee Dashboard.
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => sendInvite(inviteStaff, 'email')}
                                        disabled={inviteSending}
                                        className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {inviteSending ? 'Sending...' : '📧 Send Email Invite'}
                                    </button>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <div className="text-xs text-slate-500">
                                    <strong>What happens next:</strong>
                                    <ol className="list-decimal ml-4 mt-1 space-y-1">
                                        <li>Employee receives an email with invite link</li>
                                        <li>They click the link and set their password</li>
                                        <li>They can then log in to the Employee Dashboard</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Edit Staff Modal */}
                {editStaff && (
                    <Modal title="Edit Staff" onClose={() => setEditStaff(null)}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="First name">
                                <input
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.firstName || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                                />
                            </Field>
                            <Field label="Last name">
                                <input
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.lastName || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                                />
                            </Field>
                            <Field label="Email">
                                <input
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.email || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </Field>
                            <Field label="Account role">
                                <select
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.accountRole || 'employee'}
                                    onChange={e => setEditForm(prev => ({ ...prev, accountRole: e.target.value }))}
                                >
                                    <option value="employee">Employee</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </Field>
                            <Field label="Job role">
                                <select
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.jobRole || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, jobRole: e.target.value }))}
                                >
                                    <option value="">Select role</option>
                                    {CLINICAL_ROLES.map(r => <option key={r}>{r}</option>)}
                                </select>
                            </Field>
                            <Field label="License type">
                                <select
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.licenseType || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, licenseType: e.target.value }))}
                                >
                                    <option value="">Select license type</option>
                                    {LICENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </Field>
                            <Field label="License number">
                                <input
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.licenseNumber || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, licenseNumber: e.target.value }))}
                                />
                            </Field>
                            <Field label="License expiry">
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={editForm.licenseExpiry || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                                />
                            </Field>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button className="px-4 py-2 rounded-xl border border-slate-300 text-sm" onClick={() => setEditStaff(null)}>Cancel</button>
                            <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm" onClick={saveStaffEdit}>Save Changes</button>
                        </div>
                    </Modal>
                )}
            </div>
        );
    };

    // ============================================
    // SCHEDULE VIEW
    // ============================================

    const ScheduleView = () => {
        const canManage = has('manage_schedule');
        const staffById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), []);

        const totalGaps = useMemo(() => scheduleBlocksScoped.reduce((acc, b) => {
            const req = b.qty_needed || 1;
            const asg = (b.assigned_staff_ids || []).length + (b.external_covers || []).length;
            return acc + Math.max(0, req - asg);
        }, 0), [scheduleBlocksScoped]);

        const [assignBlock, setAssignBlock] = useState(null);

        // Get eligible staff for the role
        const eligibleStaff = useMemo(() => {
            if (!assignBlock) return [];
            return staff.filter(s =>
                s.job_role === assignBlock.role_needed &&
                s.employment_status === 'active'
            );
        }, [assignBlock, staff]);

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <div className="text-xl font-bold">Schedule</div>
                        <div className="text-sm text-slate-600 mt-1">Coverage-first roster • {currentLocName}</div>
                    </div>
                    {canManage && currentLoc !== 'ALL' && (
                        <button onClick={() => setShowShiftModal(true)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800">
                            Add schedule block
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <Card title="Coverage summary" right={totalGaps ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs">{totalGaps} gaps</span> : <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">Covered</span>}>
                        <div className="text-sm text-slate-700">{scheduleBlocksScoped.length} schedule blocks</div>
                    </Card>
                </div>

                <Card>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-left p-3">Date</th>
                                <th className="text-left p-3">Time</th>
                                <th className="text-left p-3">Role</th>
                                <th className="text-left p-3">Required</th>
                                <th className="text-left p-3">Assigned</th>
                                <th className="text-left p-3">Coverage</th>
                                {canManage && <th className="text-left p-3">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {scheduleBlocksScoped.map(b => {
                                const req = b.qty_needed || 1;
                                const asg = (b.assigned_staff_ids || []).length + (b.external_covers || []).length;
                                const covered = asg >= req;
                                const assignedNames = (b.assigned_staff_ids || []).map(id => staffById[id]).filter(Boolean).map(s => `${s.first_name} ${s.last_name}`).join(', ');
                                return (
                                    <tr key={b.id} className="border-t">
                                        <td className="p-3 font-medium">{fmtDateEA(b.date)}</td>
                                        <td className="p-3">{b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)}</td>
                                        <td className="p-3">{b.role_needed}</td>
                                        <td className="p-3">{req}</td>
                                        <td className="p-3">
                                            <span title={assignedNames || 'None assigned'}>{asg}</span>
                                            {assignedNames && <div className="text-xs text-slate-500 truncate max-w-[150px]">{assignedNames}</div>}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${covered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                                                {covered ? 'Covered' : `Short by ${req - asg}`}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="p-3">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setAssignBlock(b)}
                                                        className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                                    >
                                                        Assign
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('Delete this schedule block?')) {
                                                                await scheduleBlocksAPI.delete(clinicId, b.id);
                                                                const res = await scheduleBlocksAPI.list(clinicId);
                                                                setScheduleBlocks(res.data || []);
                                                            }
                                                        }}
                                                        className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {scheduleBlocksScoped.length === 0 && (
                                <tr><td className="p-4 text-slate-500" colSpan={6}>No schedule blocks yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </Card>

                {showShiftModal && (
                    <Modal title="Add schedule block" onClose={() => setShowShiftModal(false)}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="Date">
                                <input type="date" className="w-full px-3 py-2 rounded-xl border border-slate-300" value={newShift.date} onChange={e => setNewShift({ ...newShift, date: e.target.value })} />
                            </Field>
                            <Field label="Role needed">
                                <select className="w-full px-3 py-2 rounded-xl border border-slate-300" value={newShift.roleNeeded} onChange={e => setNewShift({ ...newShift, roleNeeded: e.target.value })}>
                                    {CLINICAL_ROLES.map(r => <option key={r}>{r}</option>)}
                                </select>
                            </Field>
                            <Field label="Start time">
                                <input className="w-full px-3 py-2 rounded-xl border border-slate-300" value={newShift.start} onChange={e => setNewShift({ ...newShift, start: e.target.value })} />
                            </Field>
                            <Field label="End time">
                                <input className="w-full px-3 py-2 rounded-xl border border-slate-300" value={newShift.end} onChange={e => setNewShift({ ...newShift, end: e.target.value })} />
                            </Field>
                            <Field label="Required headcount">
                                <input type="number" min="1" className="w-full px-3 py-2 rounded-xl border border-slate-300" value={newShift.qtyNeeded} onChange={e => setNewShift({ ...newShift, qtyNeeded: parseInt(e.target.value) || 1 })} />
                            </Field>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button className="px-4 py-2 rounded-xl border border-slate-300 text-sm" onClick={() => setShowShiftModal(false)}>Cancel</button>
                            <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm" onClick={async () => {
                                if (!newShift.date) return;
                                try {
                                    await scheduleBlocksAPI.create(clinicId, { date: newShift.date, start_time: newShift.start, end_time: newShift.end, role_needed: newShift.roleNeeded, qty_needed: newShift.qtyNeeded, location_id: currentLoc });
                                    const res = await scheduleBlocksAPI.list(clinicId);
                                    setScheduleBlocks(res.data || []);
                                    setShowShiftModal(false);
                                    addAudit('Owner', 'Added schedule block', `${newShift.date} ${newShift.roleNeeded}`);
                                } catch (err) { alert(err.message); }
                            }}>Add block</button>
                        </div>
                    </Modal>
                )}

                {/* Assign Staff Modal */}
                {assignBlock && (
                    <Modal title={`Assign Staff - ${fmtDateEA(assignBlock.date)}`} onClose={() => setAssignBlock(null)}>
                        <div className="mb-4">
                            <div className="text-sm text-slate-600 mb-2">
                                <strong>Role:</strong> {assignBlock.role_needed} &bull;
                                <strong> Time:</strong> {assignBlock.start_time?.slice(0, 5)} – {assignBlock.end_time?.slice(0, 5)} &bull;
                                <strong> Required:</strong> {assignBlock.qty_needed || 1}
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="text-sm font-medium mb-2">Currently Assigned:</div>
                            {(assignBlock.assigned_staff_ids || []).length === 0 ? (
                                <div className="text-sm text-slate-500 italic">No staff assigned yet</div>
                            ) : (
                                <div className="space-y-2">
                                    {(assignBlock.assigned_staff_ids || []).map(id => {
                                        const s = staffById[id];
                                        if (!s) return null;
                                        return (
                                            <div key={id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2">
                                                <span className="text-sm font-medium">{s.first_name} {s.last_name}</span>
                                                <button
                                                    onClick={async () => {
                                                        await scheduleBlocksAPI.assignStaff(clinicId, assignBlock.id, id, 'remove');
                                                        const res = await scheduleBlocksAPI.list(clinicId);
                                                        setScheduleBlocks(res.data || []);
                                                        setAssignBlock(res.data?.find(b => b.id === assignBlock.id) || null);
                                                    }}
                                                    className="text-red-600 text-xs hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-sm font-medium mb-2">Available {assignBlock.role_needed}s:</div>
                            {eligibleStaff.filter(s => !(assignBlock.assigned_staff_ids || []).includes(s.id)).length === 0 ? (
                                <div className="text-sm text-slate-500 italic">No more {assignBlock.role_needed.toLowerCase()}s available</div>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {eligibleStaff.filter(s => !(assignBlock.assigned_staff_ids || []).includes(s.id)).map(s => (
                                        <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-sm">{s.first_name} {s.last_name}</span>
                                            <button
                                                onClick={async () => {
                                                    await scheduleBlocksAPI.assignStaff(clinicId, assignBlock.id, s.id, 'add');
                                                    const res = await scheduleBlocksAPI.list(clinicId);
                                                    setScheduleBlocks(res.data || []);
                                                    setAssignBlock(res.data?.find(b => b.id === assignBlock.id) || null);
                                                    addAudit('Owner', 'Assigned staff', `${s.first_name} ${s.last_name} to ${assignBlock.date}`);
                                                }}
                                                className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                                            >
                                                Assign
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end mt-4">
                            <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm" onClick={() => setAssignBlock(null)}>Done</button>
                        </div>
                    </Modal>
                )}
            </div>
        );
    };

    // ============================================
    // ATTENDANCE VIEW
    // ============================================

    const AttendanceView = () => {
        const staffById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), []);

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <div className="text-xl font-bold">Attendance</div>
                        <div className="text-sm text-slate-600 mt-1">{currentLocName}</div>
                    </div>
                </div>

                <Card>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-left p-3">Date</th>
                                <th className="text-left p-3">Staff</th>
                                <th className="text-left p-3">Clock in</th>
                                <th className="text-left p-3">Clock out</th>
                                <th className="text-left p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceScoped.map(a => {
                                const s = staffById[a.staff_id];
                                return (
                                    <tr key={a.id} className="border-t border-slate-200">
                                        <td className="p-3 font-medium">{fmtDateEA(a.date)}</td>
                                        <td className="p-3">{s ? `${s.first_name} ${s.last_name}` : 'Unknown'}</td>
                                        <td className="p-3">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                        <td className="p-3">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                        <td className="p-3"><span className={statusPillClass(a.status)}>{a.status || 'present'}</span></td>
                                    </tr>
                                );
                            })}
                            {attendanceScoped.length === 0 && (
                                <tr><td className="p-4 text-slate-500" colSpan={5}>No attendance records.</td></tr>
                            )}
                        </tbody>
                    </table>
                </Card>
            </div>
        );
    };

    // ============================================
    // LEAVE VIEW
    // ============================================

    const LeaveView = () => {
        const staffById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), []);
        const canManage = has('manage_leave');

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="text-xl font-bold mb-4">Leave Requests</div>
                <Card>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-left p-3">Staff</th>
                                <th className="text-left p-3">Type</th>
                                <th className="text-left p-3">From</th>
                                <th className="text-left p-3">To</th>
                                <th className="text-left p-3">Status</th>
                                {canManage && <th className="text-right p-3">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {leavesScoped.map(l => {
                                const s = staffById[l.staff_id];
                                return (
                                    <tr key={l.id} className="border-t border-slate-200">
                                        <td className="p-3 font-medium">{s ? `${s.first_name} ${s.last_name}` : 'Unknown'}</td>
                                        <td className="p-3">{l.leave_type}</td>
                                        <td className="p-3">{fmtDateEA(l.from_date)}</td>
                                        <td className="p-3">{fmtDateEA(l.to_date)}</td>
                                        <td className="p-3"><span className={statusPillClass(l.status)}>{l.status}</span></td>
                                        {canManage && l.status === 'pending' && (
                                            <td className="p-3 text-right">
                                                <button onClick={() => leaveAPI.approve(clinicId, l.id).then(() => leaveAPI.list(clinicId).then(r => setLeaves(r.data || [])))} className="px-2 py-1 text-xs bg-green-600 text-white rounded mr-1">Approve</button>
                                                <button onClick={() => leaveAPI.reject(clinicId, l.id).then(() => leaveAPI.list(clinicId).then(r => setLeaves(r.data || [])))} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Reject</button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {leavesScoped.length === 0 && <tr><td className="p-4 text-slate-500" colSpan={6}>No leave requests.</td></tr>}
                        </tbody>
                    </table>
                </Card>
            </div>
        );
    };

    // ============================================
    // OTHER VIEWS (Simplified placeholders)
    // ============================================

    const PayrollView = () => {
        const staffById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), [staff]);
        const [dateFrom, setDateFrom] = useState(() => {
            const d = new Date();
            d.setDate(1); // First day of current month
            return d.toISOString().split('T')[0];
        });
        const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
        const [payrollData, setPayrollData] = useState([]);
        const [generating, setGenerating] = useState(false);
        const [generated, setGenerated] = useState(false);

        // Hourly rate in KES (configurable per role ideally)
        const HOURLY_RATE = 500;

        const generatePayroll = async () => {
            setGenerating(true);
            try {
                // Get attendance records for the date range
                const filteredAttendance = attendanceScoped.filter(a => {
                    return a.date >= dateFrom && a.date <= dateTo;
                });

                // Group by staff and calculate hours
                const staffPayroll = {};
                filteredAttendance.forEach(a => {
                    if (!staffPayroll[a.staff_id]) {
                        const s = staffById[a.staff_id];
                        staffPayroll[a.staff_id] = {
                            staff_id: a.staff_id,
                            name: s ? `${s.first_name} ${s.last_name}` : 'Unknown',
                            job_role: s?.job_role || 'Staff',
                            total_hours: 0,
                            days_worked: 0,
                            present_days: 0,
                            half_days: 0,
                            absent_days: 0,
                            overtime_hours: 0
                        };
                    }
                    const entry = staffPayroll[a.staff_id];
                    entry.days_worked++;

                    if (a.status === 'present') {
                        entry.present_days++;
                        entry.total_hours += a.hours_worked || 8;
                        if (a.hours_worked > 8) {
                            entry.overtime_hours += (a.hours_worked - 8);
                        }
                    } else if (a.status === 'half_day') {
                        entry.half_days++;
                        entry.total_hours += a.hours_worked || 4;
                    } else if (a.status === 'absent') {
                        entry.absent_days++;
                    }
                });

                // Calculate amounts
                const payrollList = Object.values(staffPayroll).map(p => ({
                    ...p,
                    regular_hours: Math.min(p.total_hours, p.present_days * 8 + p.half_days * 4),
                    regular_pay: Math.min(p.total_hours, p.present_days * 8 + p.half_days * 4) * HOURLY_RATE,
                    overtime_pay: p.overtime_hours * (HOURLY_RATE * 1.5),
                    gross_pay: (Math.min(p.total_hours, p.present_days * 8 + p.half_days * 4) * HOURLY_RATE) + (p.overtime_hours * HOURLY_RATE * 1.5)
                }));

                setPayrollData(payrollList);
                setGenerated(true);
            } catch (err) {
                alert('Failed to generate payroll: ' + err.message);
            } finally {
                setGenerating(false);
            }
        };

        const exportToCSV = () => {
            if (payrollData.length === 0) return;

            const headers = ['Name', 'Role', 'Days Worked', 'Present', 'Half Day', 'Absent', 'Total Hours', 'Overtime Hours', 'Regular Pay (KES)', 'Overtime Pay (KES)', 'Gross Pay (KES)'];
            const rows = payrollData.map(p => [
                p.name,
                p.job_role,
                p.days_worked,
                p.present_days,
                p.half_days,
                p.absent_days,
                p.total_hours.toFixed(1),
                p.overtime_hours.toFixed(1),
                p.regular_pay.toFixed(0),
                p.overtime_pay.toFixed(0),
                p.gross_pay.toFixed(0)
            ]);

            // Add totals row
            const totals = payrollData.reduce((acc, p) => ({
                days: acc.days + p.days_worked,
                hours: acc.hours + p.total_hours,
                overtime: acc.overtime + p.overtime_hours,
                regular: acc.regular + p.regular_pay,
                overtimePay: acc.overtimePay + p.overtime_pay,
                gross: acc.gross + p.gross_pay
            }), { days: 0, hours: 0, overtime: 0, regular: 0, overtimePay: 0, gross: 0 });

            rows.push(['TOTAL', '', totals.days, '', '', '', totals.hours.toFixed(1), totals.overtime.toFixed(1), totals.regular.toFixed(0), totals.overtimePay.toFixed(0), totals.gross.toFixed(0)]);

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_${dateFrom}_to_${dateTo}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        };

        const totalGross = payrollData.reduce((sum, p) => sum + p.gross_pay, 0);
        const totalHours = payrollData.reduce((sum, p) => sum + p.total_hours, 0);

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <div className="text-xl font-bold">Payroll Export</div>
                        <div className="text-sm text-slate-600 mt-1">Generate payroll from attendance data • {currentLocName}</div>
                    </div>
                </div>

                {/* Date Range & Generate */}
                <Card className="mb-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <Field label="From date">
                            <input
                                type="date"
                                className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                            />
                        </Field>
                        <Field label="To date">
                            <input
                                type="date"
                                className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                            />
                        </Field>
                        <button
                            onClick={generatePayroll}
                            disabled={generating}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {generating ? 'Generating...' : '📊 Generate Payroll'}
                        </button>
                        {generated && payrollData.length > 0 && (
                            <button
                                onClick={exportToCSV}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
                            >
                                📥 Export CSV
                            </button>
                        )}
                    </div>
                </Card>

                {/* Summary Cards */}
                {generated && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <Card title="Total Staff">
                            <div className="text-2xl font-bold text-slate-900">{payrollData.length}</div>
                        </Card>
                        <Card title="Total Hours">
                            <div className="text-2xl font-bold text-slate-900">{totalHours.toFixed(1)}</div>
                        </Card>
                        <Card title="Gross Payroll">
                            <div className="text-2xl font-bold text-emerald-600">KES {totalGross.toLocaleString()}</div>
                        </Card>
                        <Card title="Period">
                            <div className="text-sm text-slate-600">{fmtDateEA(dateFrom)} – {fmtDateEA(dateTo)}</div>
                        </Card>
                    </div>
                )}

                {/* Payroll Table */}
                <Card>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-left p-3">Name</th>
                                <th className="text-left p-3">Role</th>
                                <th className="text-center p-3">Days</th>
                                <th className="text-center p-3">Present</th>
                                <th className="text-center p-3">Half</th>
                                <th className="text-center p-3">Absent</th>
                                <th className="text-right p-3">Hours</th>
                                <th className="text-right p-3">OT Hrs</th>
                                <th className="text-right p-3">Gross (KES)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payrollData.map(p => (
                                <tr key={p.staff_id} className="border-t border-slate-200">
                                    <td className="p-3 font-medium">{p.name}</td>
                                    <td className="p-3">{p.job_role}</td>
                                    <td className="p-3 text-center">{p.days_worked}</td>
                                    <td className="p-3 text-center text-emerald-600">{p.present_days}</td>
                                    <td className="p-3 text-center text-amber-600">{p.half_days}</td>
                                    <td className="p-3 text-center text-red-600">{p.absent_days}</td>
                                    <td className="p-3 text-right">{p.total_hours.toFixed(1)}</td>
                                    <td className="p-3 text-right text-blue-600">{p.overtime_hours.toFixed(1)}</td>
                                    <td className="p-3 text-right font-semibold">{p.gross_pay.toLocaleString()}</td>
                                </tr>
                            ))}
                            {payrollData.length === 0 && (
                                <tr>
                                    <td className="p-4 text-center text-slate-500" colSpan={9}>
                                        {generated ? 'No attendance records found for this period.' : 'Select a date range and click "Generate Payroll" to calculate staff pay.'}
                                    </td>
                                </tr>
                            )}
                            {payrollData.length > 0 && (
                                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                                    <td className="p-3">TOTAL</td>
                                    <td className="p-3"></td>
                                    <td className="p-3 text-center">{payrollData.reduce((s, p) => s + p.days_worked, 0)}</td>
                                    <td className="p-3 text-center text-emerald-600">{payrollData.reduce((s, p) => s + p.present_days, 0)}</td>
                                    <td className="p-3 text-center text-amber-600">{payrollData.reduce((s, p) => s + p.half_days, 0)}</td>
                                    <td className="p-3 text-center text-red-600">{payrollData.reduce((s, p) => s + p.absent_days, 0)}</td>
                                    <td className="p-3 text-right">{totalHours.toFixed(1)}</td>
                                    <td className="p-3 text-right text-blue-600">{payrollData.reduce((s, p) => s + p.overtime_hours, 0).toFixed(1)}</td>
                                    <td className="p-3 text-right text-emerald-700">KES {totalGross.toLocaleString()}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </Card>

                {/* Hourly Rate Info */}
                <div className="mt-4 text-xs text-slate-500">
                    <strong>Note:</strong> Calculations based on KES {HOURLY_RATE}/hour regular rate, 1.5x for overtime (hours &gt; 8/day).
                    Adjust rates in settings for accurate payroll.
                </div>
            </div>
        );
    };

    const VerificationView = () => {
        const [orgVerification, setOrgVerification] = useState({
            kra_pin: '',
            business_reg_no: '',
            status: 'draft'
        });
        const [selectedLocation, setSelectedLocation] = useState(null);
        const [facilityData, setFacilityData] = useState({
            license_no: '',
            licensing_body: '',
            license_expiry: '',
            status: 'draft'
        });
        const [saving, setSaving] = useState(false);
        const [loadingVerification, setLoadingVerification] = useState(true);

        // Fetch fresh org verification data on mount with timeout
        useEffect(() => {
            // First, use cached org data immediately to prevent waiting
            const cachedStatus = org?.org_verification_status || org?.orgVerification?.status || 'draft';
            const cachedKra = org?.kra_pin || org?.orgVerification?.kraPin || '';
            const cachedBizReg = org?.business_reg_no || org?.orgVerification?.businessRegNo || '';

            setOrgVerification({
                kra_pin: cachedKra,
                business_reg_no: cachedBizReg,
                status: cachedStatus
            });
            setLoadingVerification(false);

            // Then try to fetch fresh data in background with timeout
            const fetchVerificationData = async () => {
                try {
                    // Create a timeout promise
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                    );

                    // Race between fetch and timeout
                    const orgRes = await Promise.race([
                        verificationAPI.getOrg(clinicId),
                        timeoutPromise
                    ]);

                    if (orgRes?.data) {
                        setOrgVerification({
                            kra_pin: orgRes.data.kra_pin || '',
                            business_reg_no: orgRes.data.business_reg_no || '',
                            status: orgRes.data.org_verification_status || 'draft'
                        });
                    }
                } catch (err) {
                    console.log('Background verification fetch failed/timed out, using cached data');
                }
            };

            fetchVerificationData();
        }, [clinicId, org]);

        // Load facility data when location is selected
        useEffect(() => {
            if (selectedLocation) {
                const loc = locations.find(l => l.id === selectedLocation);
                if (loc) {
                    setFacilityData({
                        license_no: loc.license_no || '',
                        licensing_body: loc.licensing_body || '',
                        license_expiry: loc.license_expiry || '',
                        status: loc.facility_verification_status || 'draft'
                    });
                }
            }
        }, [selectedLocation, locations]);

        const saveOrgVerification = async (submitForReview = false) => {
            setSaving(true);
            try {
                const status = submitForReview ? 'pending_review' : 'draft';
                await verificationAPI.updateOrg(clinicId, {
                    kra_pin: orgVerification.kra_pin,
                    business_reg_no: orgVerification.business_reg_no,
                    org_verification_status: status
                });
                setOrgVerification(prev => ({ ...prev, status }));
                setOrg(prev => ({
                    ...prev,
                    orgVerification: {
                        ...prev.orgVerification,
                        kraPin: orgVerification.kra_pin,
                        businessRegNo: orgVerification.business_reg_no,
                        status
                    }
                }));
                addAudit('Owner', submitForReview ? 'Submitted org verification' : 'Saved org verification', `Status: ${status}`);
                if (submitForReview) alert('Organization verification submitted for review!');
            } catch (err) {
                alert('Failed to save: ' + err.message);
            } finally {
                setSaving(false);
            }
        };

        const saveFacilityVerification = async (submitForReview = false) => {
            if (!selectedLocation) return;
            setSaving(true);
            try {
                const status = submitForReview ? 'pending_review' : 'draft';
                await verificationAPI.updateFacility(clinicId, selectedLocation, {
                    license_no: facilityData.license_no,
                    licensing_body: facilityData.licensing_body,
                    license_expiry: facilityData.license_expiry,
                    facility_verification_status: status
                });
                setFacilityData(prev => ({ ...prev, status }));
                // Update locations state
                const res = await locationsAPI.list(clinicId);
                setLocations(res.data || []);
                addAudit('Owner', submitForReview ? 'Submitted facility verification' : 'Saved facility verification', `Location: ${selectedLocation}`);
                if (submitForReview) alert('Facility verification submitted for review!');
            } catch (err) {
                alert('Failed to save: ' + err.message);
            } finally {
                setSaving(false);
            }
        };

        const getStatusBadge = (status) => {
            const statusMap = {
                'draft': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draft' },
                'pending_review': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Review' },
                'approved': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
                'rejected': { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' }
            };
            const s = statusMap[status] || statusMap.draft;
            return <span className={`px-2 py-0.5 rounded-full text-xs ${s.bg} ${s.text}`}>{s.label}</span>;
        };

        if (loadingVerification) {
            return (
                <div className="max-w-7xl mx-auto p-4">
                    <div className="text-xl font-bold mb-4">Verification</div>
                    <div className="text-center py-8 text-slate-500">Loading verification status...</div>
                </div>
            );
        }

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="text-xl font-bold mb-4">Verification</div>
                <div className="text-sm text-slate-600 mb-4">Submit your organization and facility documents for verification by HURE administrators.</div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Organization Verification */}
                    <Card title="Organization Verification" right={getStatusBadge(orgVerification.status)}>
                        <div className="space-y-3">
                            <Field label="KRA PIN">
                                <input
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    placeholder="Enter KRA PIN"
                                    value={orgVerification.kra_pin}
                                    onChange={e => setOrgVerification(prev => ({ ...prev, kra_pin: e.target.value }))}
                                    disabled={orgVerification.status === 'approved'}
                                />
                            </Field>
                            <Field label="Business Registration No.">
                                <input
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    placeholder="Enter business registration number"
                                    value={orgVerification.business_reg_no}
                                    onChange={e => setOrgVerification(prev => ({ ...prev, business_reg_no: e.target.value }))}
                                    disabled={orgVerification.status === 'approved'}
                                />
                            </Field>

                            {orgVerification.status !== 'approved' && (
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => saveOrgVerification(false)}
                                        disabled={saving}
                                        className="px-4 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Save Draft
                                    </button>
                                    <button
                                        onClick={() => saveOrgVerification(true)}
                                        disabled={saving || !orgVerification.kra_pin || !orgVerification.business_reg_no}
                                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {saving ? 'Submitting...' : '📤 Submit for Review'}
                                    </button>
                                </div>
                            )}

                            {orgVerification.status === 'approved' && (
                                <div className="text-sm text-emerald-600 font-medium pt-2">✓ Your organization is verified!</div>
                            )}
                            {orgVerification.status === 'rejected' && (
                                <div className="text-sm text-red-600 pt-2">Your verification was rejected. Please update and resubmit.</div>
                            )}
                        </div>
                    </Card>

                    {/* Facility Verification */}
                    <Card title="Facility Verification">
                        <div className="space-y-3">
                            <Field label="Select Location">
                                <select
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                    value={selectedLocation || ''}
                                    onChange={e => setSelectedLocation(e.target.value || null)}
                                >
                                    <option value="">Choose a location...</option>
                                    {locations.map(l => (
                                        <option key={l.id} value={l.id}>{l.name} {l.facility_verification_status === 'approved' ? '✓' : ''}</option>
                                    ))}
                                </select>
                            </Field>

                            {selectedLocation && (
                                <>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">Status:</span>
                                        {getStatusBadge(facilityData.status)}
                                    </div>

                                    <Field label="License Number">
                                        <input
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                            placeholder="Enter facility license number"
                                            value={facilityData.license_no}
                                            onChange={e => setFacilityData(prev => ({ ...prev, license_no: e.target.value }))}
                                            disabled={facilityData.status === 'approved'}
                                        />
                                    </Field>
                                    <Field label="Licensing Body">
                                        <select
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                            value={facilityData.licensing_body}
                                            onChange={e => setFacilityData(prev => ({ ...prev, licensing_body: e.target.value }))}
                                            disabled={facilityData.status === 'approved'}
                                        >
                                            <option value="">Select licensing body...</option>
                                            <option value="KMPDB">Kenya Medical Practitioners and Dentists Board (KMPDB)</option>
                                            <option value="NCK">Nursing Council of Kenya (NCK)</option>
                                            <option value="PPB">Pharmacy and Poisons Board (PPB)</option>
                                            <option value="MOH">Ministry of Health</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </Field>
                                    <Field label="License Expiry Date">
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                            value={facilityData.license_expiry}
                                            onChange={e => setFacilityData(prev => ({ ...prev, license_expiry: e.target.value }))}
                                            disabled={facilityData.status === 'approved'}
                                        />
                                    </Field>

                                    {facilityData.status !== 'approved' && (
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => saveFacilityVerification(false)}
                                                disabled={saving}
                                                className="px-4 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Save Draft
                                            </button>
                                            <button
                                                onClick={() => saveFacilityVerification(true)}
                                                disabled={saving || !facilityData.license_no}
                                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {saving ? 'Submitting...' : '📤 Submit for Review'}
                                            </button>
                                        </div>
                                    )}

                                    {facilityData.status === 'approved' && (
                                        <div className="text-sm text-emerald-600 font-medium pt-2">✓ This facility is verified!</div>
                                    )}
                                </>
                            )}

                            {!selectedLocation && (
                                <div className="text-sm text-slate-500 italic">Select a location above to view and update facility verification.</div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Verification Status Summary */}
                <Card className="mt-4" title="Verification Summary">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm font-medium mb-2">Organization</div>
                            <div className="flex items-center gap-2">
                                {getStatusBadge(orgVerification.status)}
                                <span className="text-xs text-slate-500">
                                    {orgVerification.status === 'approved' ? 'Your organization is fully verified' :
                                        orgVerification.status === 'pending_review' ? 'Under review by HURE team' :
                                            'Complete and submit for verification'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium mb-2">Facilities ({locations.length} locations)</div>
                            <div className="space-y-1">
                                {locations.map(l => (
                                    <div key={l.id} className="flex items-center gap-2 text-xs">
                                        <span className="font-medium">{l.name}:</span>
                                        {getStatusBadge(l.facility_verification_status || 'draft')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    };

    const SettingsView = () => {
        const [orgName, setOrgName] = useState(org.name || '');
        const [saving, setSaving] = useState(false);
        const [saved, setSaved] = useState(false);

        const handleSaveOrgName = async () => {
            if (!orgName.trim()) return;
            setSaving(true);
            setSaved(false);
            try {
                await settingsAPI.update(clinicId, { clinic: { name: orgName.trim() } });
                setOrg(prev => ({ ...prev, name: orgName.trim() }));
                setSaved(true);
                addAudit('Owner', 'Updated organization name', `New name: ${orgName.trim()}`);
                setTimeout(() => setSaved(false), 3000);
            } catch (err) {
                alert('Failed to save: ' + err.message);
            } finally {
                setSaving(false);
            }
        };

        return (
            <div className="max-w-7xl mx-auto p-4">
                <div className="text-xl font-bold mb-4">Settings</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card title="Organization">
                        <Field label="Organization name">
                            <input
                                className="w-full px-3 py-2 rounded-xl border border-slate-300"
                                value={orgName}
                                onChange={e => setOrgName(e.target.value)}
                                placeholder="Enter organization name"
                            />
                        </Field>
                        <div className="flex items-center gap-3 mt-3">
                            <button
                                onClick={handleSaveOrgName}
                                disabled={saving || !orgName.trim() || orgName.trim() === org.name}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            {saved && <span className="text-sm text-emerald-600">✓ Saved!</span>}
                        </div>
                    </Card>
                    <Card title="Locations">
                        <div className="text-sm text-slate-700">You have {locations.length} location(s).</div>
                        {locations.map(l => (
                            <div key={l.id} className="flex items-center justify-between py-2 border-t">
                                <span>{l.name}</span>
                                <span className={statusPillClass(l.facility_verification_status)}>{l.facility_verification_status?.replace(/_/g, ' ') || 'draft'}</span>
                            </div>
                        ))}
                    </Card>
                </div>
            </div>
        );
    };

    const BillingView = () => (
        <div className="max-w-7xl mx-auto p-4">
            <div className="text-xl font-bold mb-4">Billing</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="Current plan" right={<span className={statusPillClass(org.plan.status)}>{org.plan.status}</span>}>
                    <div className="text-sm">Tier: <span className="font-semibold">{org.plan.tier}</span></div>
                    <div className="text-sm mt-1">Renewal: {fmtDateEA(org.plan.renewOn)}</div>
                </Card>
                <Card title="Plan limits">
                    <div className="text-sm">Locations: {limits.locations}</div>
                    <div className="text-sm">Staff: {limits.staff}</div>
                </Card>
                <Card title="Invoices">
                    <div className="text-sm">Last invoice: {org.billing.lastInvoiceId}</div>
                </Card>
            </div>
        </div>
    );

    const DocsView = () => (
        <div className="max-w-7xl mx-auto p-4">
            <div className="text-xl font-bold mb-4">Documents</div>
            <Card><div className="text-sm text-slate-500 p-4">Upload and manage clinic documents.</div></Card>
        </div>
    );

    const AuditView = () => (
        <div className="max-w-7xl mx-auto p-4">
            <div className="text-xl font-bold mb-4">Audit Log</div>
            <Card>
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="text-left p-3">Time</th>
                            <th className="text-left p-3">Actor</th>
                            <th className="text-left p-3">Action</th>
                            <th className="text-left p-3">Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {audit.slice(0, 50).map(a => (
                            <tr key={a.id} className="border-t">
                                <td className="p-3">{new Date(a.created_at).toLocaleString()}</td>
                                <td className="p-3 font-medium">{a.actor_name}</td>
                                <td className="p-3">{a.type}</td>
                                <td className="p-3 text-slate-700">{a.detail}</td>
                            </tr>
                        ))}
                        {audit.length === 0 && <tr><td className="p-4 text-slate-500" colSpan={4}>No audit entries.</td></tr>}
                    </tbody>
                </table>
            </Card>
        </div>
    );

    // ============================================
    // MAIN RENDER
    // ============================================

    const renderView = () => {
        if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
        switch (view) {
            case 'dashboard': return <DashboardView />;
            case 'staff': return <StaffView />;
            case 'schedule': return <ScheduleView />;
            case 'attendance': return <AttendanceView />;
            case 'payroll': return <PayrollView />;
            case 'leave': return <LeaveView />;
            case 'verification': return <VerificationView />;
            case 'settings': return <SettingsView />;
            case 'billing': return <BillingView />;
            case 'docs': return <DocsView />;
            case 'audit': return <AuditView />;
            default: return <DashboardView />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <TopBar />
            <div className="flex pt-[53px] min-h-screen">
                <Sidebar />
                <div className="flex-1 p-6">
                    {renderView()}
                </div>
            </div>
        </div>
    );
}
