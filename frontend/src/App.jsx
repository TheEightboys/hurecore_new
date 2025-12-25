import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from './api';
import { PLAN_CONFIG, getPlanLabel, getModulesLabel, calculateBundlePrice } from './plans';

/**
 * HURE SuperAdmin Dashboard
 * Connected to backend API
 */
export default function HureSuperadminApp() {
    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());

    // Data state
    const [clinics, setClinics] = useState([]);
    const [pendingClinics, setPendingClinics] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [promos, setPromos] = useState([]);
    const [audit, setAudit] = useState([]);
    const [apiLogs, setApiLogs] = useState([]);
    const [siteContent, setSiteContent] = useState({});
    const [stats, setStats] = useState({});

    // UI state
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [selectedClinicId, setSelectedClinicId] = useState(null);
    const [pendingFilter, setPendingFilter] = useState('');
    const [clinicFilter, setClinicFilter] = useState('all');
    const [auditFilterType, setAuditFilterType] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Fetch data on mount
    useEffect(() => {
        if (isAuthenticated) {
            loadDashboardData();
        }
    }, [isAuthenticated]);

    // Load all dashboard data
    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [clinicsRes, subsRes, txRes, promosRes, auditRes, contentRes] = await Promise.all([
                api.getClinics(),
                api.getSubscriptions(),
                api.getTransactions(),
                api.getPromos(),
                api.getAuditLogs({ limit: 100 }),
                api.getSiteContent()
            ]);

            const allClinics = clinicsRes.clinics || [];
            setClinics(allClinics.filter(c => c.status === 'active' || c.status === 'suspended'));
            setPendingClinics(allClinics.filter(c => c.status.startsWith('pending') || c.status === 'rejected'));
            setSubscriptions(subsRes.subscriptions || []);
            setTransactions(txRes.transactions || []);
            setPromos(promosRes.promos || []);
            setAudit(auditRes.logs || []);
            setSiteContent(contentRes || {});

            // Calculate stats
            setStats({
                total: allClinics.length,
                pending: allClinics.filter(c => c.status.startsWith('pending')).length,
                active: allClinics.filter(c => c.status === 'active').length,
                bundles: allClinics.filter(c => c.is_bundle).length,
                careOnly: allClinics.filter(c => c.modules?.length === 1 && c.modules[0] === 'care').length
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Demo login (for development)
    const handleDemoLogin = useCallback(() => {
        // Generate a demo token for testing
        const demoToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InNhZG1pbi1kZW1vIiwiZW1haWwiOiJhZG1pbkBodXJlLmNvbSIsInJvbGUiOiJzdXBlcmFkbWluIiwibmFtZSI6IlN1cGVyQWRtaW4gRGVtbyJ9.demo';
        api.setToken(demoToken);
        setIsAuthenticated(true);
    }, []);

    // Clinic actions
    const handleActivateClinic = async (id) => {
        try {
            const result = await api.activateClinic(id);
            loadDashboardData();
            // Show first-login URL for testing (when using Resend test mode)
            if (result.firstLoginUrl) {
                const useLink = confirm(
                    `Clinic activated!\n\n` +
                    `First-login URL (for testing - copy this link):\n${result.firstLoginUrl}\n\n` +
                    `Click OK to open the first-login page, or Cancel to copy the URL.`
                );
                if (useLink) {
                    window.open(result.firstLoginUrl, '_blank');
                } else {
                    navigator.clipboard.writeText(result.firstLoginUrl);
                    alert('URL copied to clipboard!');
                }
            }
        } catch (err) {
            alert('Failed to activate: ' + err.message);
        }
    };

    const handleSuspendClinic = async (id) => {
        const reason = prompt('Reason for suspension (optional):');
        try {
            await api.suspendClinic(id, reason);
            loadDashboardData();
        } catch (err) {
            alert('Failed to suspend: ' + err.message);
        }
    };

    const handleRejectClinic = async (id) => {
        const reason = prompt('Reason for rejection (optional):');
        try {
            await api.rejectClinic(id, reason);
            loadDashboardData();
        } catch (err) {
            alert('Failed to reject: ' + err.message);
        }
    };

    // Promo actions
    const handleCreatePromo = async (code, discountPercent, expiresAt) => {
        try {
            await api.createPromo({ code, discountPercent, expiresAt });
            loadDashboardData();
        } catch (err) {
            alert('Failed to create promo: ' + err.message);
        }
    };

    const handleTogglePromo = async (id) => {
        try {
            await api.togglePromo(id);
            loadDashboardData();
        } catch (err) {
            alert('Failed to toggle promo: ' + err.message);
        }
    };

    // Site content update
    const handleUpdateSiteContent = async (key, value) => {
        try {
            await api.updateSiteContent({ [key]: value });
            setSiteContent(prev => ({ ...prev, [key]: value }));
        } catch (err) {
            alert('Failed to update: ' + err.message);
        }
    };

    // Computed values
    const selectedClinic = useMemo(
        () => clinics.find(c => c.id === selectedClinicId) || null,
        [clinics, selectedClinicId]
    );

    const filteredPending = useMemo(() => {
        if (!pendingFilter) return pendingClinics;
        return pendingClinics.filter(p => p.status === pendingFilter);
    }, [pendingClinics, pendingFilter]);

    const filteredClinics = useMemo(() => {
        if (clinicFilter === 'all') return clinics;
        if (clinicFilter === 'bundle') return clinics.filter(c => c.is_bundle);
        if (clinicFilter === 'core') return clinics.filter(c => c.modules?.length === 1 && c.modules[0] === 'core');
        if (clinicFilter === 'care') return clinics.filter(c => c.modules?.length === 1 && c.modules[0] === 'care');
        return clinics;
    }, [clinics, clinicFilter]);

    const filteredAudit = useMemo(() => {
        if (auditFilterType === 'all') return audit;
        return audit.filter(a => a.type === auditFilterType);
    }, [audit, auditFilterType]);

    const uniqueAuditTypes = useMemo(() =>
        [...new Set(audit.map(a => a.type))],
        [audit]
    );

    // Login screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="text-emerald-700 font-bold text-xl">HURE</div>
                        <div className="text-lg font-semibold">SuperAdmin Login</div>
                    </div>
                    <button
                        onClick={handleDemoLogin}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                    >
                        Enter Demo Mode
                    </button>
                    <p className="text-xs text-slate-500 mt-4 text-center">
                        Demo mode uses a test token. In production, implement proper auth.
                    </p>
                    <div className="mt-6 text-center">
                        <a href="/" className="text-emerald-600 hover:underline text-sm">
                            ← Back to Homepage
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Stat Card Component - Enhanced
    const StatCard = ({ label, value, accent = 'emerald' }) => {
        const accentColors = {
            emerald: 'from-emerald-500 to-emerald-600',
            blue: 'from-blue-500 to-blue-600',
            amber: 'from-amber-500 to-amber-600',
            purple: 'from-purple-500 to-purple-600'
        };
        return (
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 p-5 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${accentColors[accent]} opacity-10 rounded-bl-full`}></div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
                <div className="text-3xl font-bold mt-2 text-slate-800">{value}</div>
            </div>
        );
    };

    // Dashboard Tab - Compact (fits in viewport)
    const DashboardTab = () => (
        <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Clinics" value={stats.total || 0} accent="emerald" />
                <StatCard label="Active Clinics" value={stats.active || 0} accent="blue" />
                <StatCard label="Active Bundles" value={stats.bundles || 0} accent="amber" />
                <StatCard label="Care-Only" value={stats.careOnly || 0} accent="purple" />
            </div>

            {/* Plans and Audit in 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Core Plans */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Core Plans
                    </h2>
                    <div className="space-y-2">
                        {Object.entries(PLAN_CONFIG.core).map(([key, cfg]) => (
                            <div key={key} className="flex justify-between items-center py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm">
                                <span className="font-medium text-slate-700">{cfg.label}</span>
                                <span className="text-xs text-slate-500">
                                    KSh {cfg.price.toLocaleString()} · {cfg.maxStaff} staff
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Care Plans */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Care Plans
                    </h2>
                    <div className="space-y-2">
                        {Object.entries(PLAN_CONFIG.care).map(([key, cfg]) => (
                            <div key={key} className="flex justify-between items-center py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm">
                                <span className="font-medium text-slate-700">{cfg.label}</span>
                                <span className="text-xs text-slate-500">
                                    KSh {cfg.price.toLocaleString()} · Unlimited staff
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Audit Events */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        Recent Audit Events
                    </h2>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {audit.slice(0, 4).map(item => (
                            <div key={item.id} className="py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div className="font-medium text-slate-700 text-sm">{item.type}</div>
                                <div className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</div>
                            </div>
                        ))}
                        {audit.length === 0 && (
                            <div className="text-center py-4 text-slate-400">
                                <div className="text-xl mb-1">📋</div>
                                <div className="text-xs">No audit events yet</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // Pending Tab - Enhanced
    const PendingTab = () => (
        <div className="space-y-6">
            {/* Header with filter */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-lg text-slate-800">Pending Clinics</h2>
                    <p className="text-sm text-slate-500 mt-1">Review and activate new clinic registrations</p>
                </div>
                <select
                    className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={pendingFilter}
                    onChange={e => setPendingFilter(e.target.value)}
                >
                    <option value="">All Status</option>
                    <option value="pending_verification">Pending Verification</option>
                    <option value="pending_payment">Pending Payment</option>
                    <option value="pending_activation">Pending Activation</option>
                </select>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <tr>
                            <th className="px-6 py-4">Clinic</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Modules</th>
                            <th className="px-6 py-4">Plan</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredPending.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                                <td className="px-6 py-4 text-slate-600">{p.email}</td>
                                <td className="px-6 py-4 text-slate-600">{getModulesLabel(p.modules || [], p.is_bundle)}</td>
                                <td className="px-6 py-4 text-slate-600">{getPlanLabel(p.plan_product, p.plan_key)}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                        {p.status?.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        {p.status !== 'rejected' && (
                                            <button
                                                onClick={() => handleActivateClinic(p.id)}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                            >
                                                Activate
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRejectClinic(p.id)}
                                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredPending.length === 0 && (
                            <tr>
                                <td className="px-6 py-12 text-center text-slate-400" colSpan={6}>
                                    <div className="text-3xl mb-2">🎉</div>
                                    <div className="text-sm">No pending clinics</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Clinics Tab - Enhanced
    const ClinicsTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Clinics Table */}
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold text-lg text-slate-800">All Clinics</h2>
                        <p className="text-sm text-slate-500 mt-1">{filteredClinics.length} clinics</p>
                    </div>
                    <select
                        className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={clinicFilter}
                        onChange={e => setClinicFilter(e.target.value)}
                    >
                        <option value="all">All Types</option>
                        <option value="core">Core Only</option>
                        <option value="care">Care Only</option>
                        <option value="bundle">Bundle</option>
                    </select>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-6 py-4">Clinic</th>
                                <th className="px-6 py-4">Modules</th>
                                <th className="px-6 py-4">Plan</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Usage</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClinics.map(c => (
                                <tr key={c.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedClinicId === c.id ? 'bg-emerald-50' : ''}`} onClick={() => setSelectedClinicId(c.id)}>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-800">{c.name}</div>
                                        <div className="text-xs text-slate-500">{c.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{getModulesLabel(c.modules || [], c.is_bundle)}</td>
                                    <td className="px-6 py-4 text-slate-600">{getPlanLabel(c.plan_product, c.plan_key)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <span className="text-slate-800 font-medium">{c.staff_count || 0}</span> staff · <span className="text-slate-800 font-medium">{c.location_count || 0}</span> loc
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedClinicId(c.id); }}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                                            >
                                                View
                                            </button>
                                            {c.status === 'active' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleSuspendClinic(c.id); }}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
                                                >
                                                    Suspend
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Clinic Details Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit sticky top-4">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Clinic Details
                </h2>
                {!selectedClinic && (
                    <div className="text-center py-8 text-slate-400">
                        <div className="text-3xl mb-2">👆</div>
                        <div className="text-sm">Select a clinic to view details</div>
                    </div>
                )}
                {selectedClinic && (
                    <div className="space-y-4">
                        <div className="pb-4 border-b border-slate-100">
                            <div className="font-semibold text-lg text-slate-800">{selectedClinic.name}</div>
                            <div className="text-sm text-slate-500">{selectedClinic.email}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                                <div className="text-xs text-slate-500 uppercase tracking-wide">Plan</div>
                                <div className="font-semibold text-slate-800 mt-1">{getPlanLabel(selectedClinic.plan_product, selectedClinic.plan_key)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
                                <div className="text-xs text-slate-500 uppercase tracking-wide">Staff</div>
                                <div className="font-semibold text-slate-800 mt-1">{selectedClinic.staff_count || 0}</div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                                <div className="text-xs text-slate-500 uppercase tracking-wide">Locations</div>
                                <div className="font-semibold text-slate-800 mt-1">{selectedClinic.location_count || 0}</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                                <div className="text-xs text-slate-500 uppercase tracking-wide">Bundle</div>
                                <div className="font-semibold text-slate-800 mt-1">{selectedClinic.is_bundle ? 'Yes' : 'No'}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // Transactions Tab - Enhanced
    const TransactionsTab = () => (
        <div className="space-y-6">
            <div>
                <h2 className="font-semibold text-lg text-slate-800">Transactions</h2>
                <p className="text-sm text-slate-500 mt-1">Payment history and transaction records</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <tr>
                            <th className="px-6 py-4">Reference</th>
                            <th className="px-6 py-4">Clinic</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {transactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-slate-600">{t.tx_ref || t.id.slice(0, 8)}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">{t.clinic?.name || 'N/A'}</td>
                                <td className="px-6 py-4 font-semibold text-slate-800">KSh {(t.final_amount || 0).toLocaleString()}</td>
                                <td className="px-6 py-4 text-slate-600">{t.method || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${t.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                                        t.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{new Date(t.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr>
                                <td className="px-6 py-12 text-center text-slate-400" colSpan={6}>
                                    <div className="text-3xl mb-2">💳</div>
                                    <div className="text-sm">No transactions yet</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Subscriptions Tab - Enhanced
    const SubscriptionsTab = () => (
        <div className="space-y-6">
            <div>
                <h2 className="font-semibold text-lg text-slate-800">Subscriptions</h2>
                <p className="text-sm text-slate-500 mt-1">Active subscription plans and renewals</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <tr>
                            <th className="px-6 py-4">Clinic</th>
                            <th className="px-6 py-4">Plan</th>
                            <th className="px-6 py-4">Modules</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Next Renewal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {subscriptions.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-800">{s.clinic?.name || 'N/A'}</td>
                                <td className="px-6 py-4 text-slate-600">{getPlanLabel(s.plan_product, s.plan_key)}</td>
                                <td className="px-6 py-4 text-slate-600">{getModulesLabel(s.modules || [], s.is_bundle)}</td>
                                <td className="px-6 py-4 font-semibold text-slate-800">KSh {(s.final_amount || 0).toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {s.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    {s.next_renewal_at ? new Date(s.next_renewal_at).toLocaleDateString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {subscriptions.length === 0 && (
                            <tr>
                                <td className="px-6 py-12 text-center text-slate-400" colSpan={6}>
                                    <div className="text-3xl mb-2">📋</div>
                                    <div className="text-sm">No subscriptions yet</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Promos Tab
    const PromosTab = () => {
        const [code, setCode] = useState('');
        const [discount, setDiscount] = useState(10);
        const [expiresAt, setExpiresAt] = useState('');

        const handleCreate = () => {
            if (!code) return;
            handleCreatePromo(code.toUpperCase(), discount, expiresAt);
            setCode('');
            setDiscount(10);
            setExpiresAt('');
        };

        return (
            <div className="space-y-4">
                <h2 className="font-semibold text-sm">Promo Codes</h2>
                <div className="bg-white border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                        <input
                            className="border rounded px-2 py-1 flex-1 min-w-[120px]"
                            placeholder="CODE"
                            value={code}
                            onChange={e => setCode(e.target.value.toUpperCase())}
                        />
                        <input
                            className="border rounded px-2 py-1 w-24"
                            type="number"
                            min="0"
                            max="100"
                            value={discount}
                            onChange={e => setDiscount(Number(e.target.value))}
                            placeholder="%"
                        />
                        <input
                            className="border rounded px-2 py-1 w-40"
                            type="date"
                            value={expiresAt}
                            onChange={e => setExpiresAt(e.target.value)}
                        />
                        <button
                            className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                            onClick={handleCreate}
                        >
                            Create
                        </button>
                    </div>

                    <div className="border-t pt-3">
                        <ul className="space-y-2 text-sm">
                            {promos.map(p => (
                                <li key={p.id} className="flex items-center justify-between border rounded px-3 py-2">
                                    <div>
                                        <div className="font-medium">{p.code}</div>
                                        <div className="text-xs text-slate-500">
                                            {p.discount_percent}% · Expires {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '—'}
                                        </div>
                                    </div>
                                    <button
                                        className="px-2 py-1 text-xs rounded border"
                                        onClick={() => handleTogglePromo(p.id)}
                                    >
                                        {p.active ? 'Deactivate' : 'Activate'}
                                    </button>
                                </li>
                            ))}
                            {promos.length === 0 && (
                                <li className="text-xs text-slate-500">No promos yet.</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        );
    };

    // Verifications Tab
    const VerificationsTab = () => {
        const [pendingVerifications, setPendingVerifications] = useState({ organizations: [], facilities: [] });
        const [loadingVerifications, setLoadingVerifications] = useState(true);

        useEffect(() => {
            loadVerifications();
        }, []);

        const loadVerifications = async () => {
            try {
                const res = await api.getPendingVerifications();
                setPendingVerifications(res.data || { organizations: [], facilities: [] });
            } catch (err) {
                console.error('Failed to load verifications:', err);
            } finally {
                setLoadingVerifications(false);
            }
        };

        const handleApproveOrg = async (clinicId) => {
            try {
                await api.approveOrgVerification(clinicId);
                loadVerifications();
                loadDashboardData();
            } catch (err) {
                alert('Failed to approve: ' + err.message);
            }
        };

        const handleRejectOrg = async (clinicId) => {
            const reason = prompt('Reason for rejection (optional):');
            try {
                await api.rejectOrgVerification(clinicId, reason);
                loadVerifications();
                loadDashboardData();
            } catch (err) {
                alert('Failed to reject: ' + err.message);
            }
        };

        const handleApproveFacility = async (clinicId, locationId) => {
            try {
                await api.approveFacilityVerification(clinicId, locationId);
                loadVerifications();
                loadDashboardData();
            } catch (err) {
                alert('Failed to approve: ' + err.message);
            }
        };

        const handleRejectFacility = async (clinicId, locationId) => {
            const reason = prompt('Reason for rejection (optional):');
            try {
                await api.rejectFacilityVerification(clinicId, locationId, reason);
                loadVerifications();
                loadDashboardData();
            } catch (err) {
                alert('Failed to reject: ' + err.message);
            }
        };

        if (loadingVerifications) {
            return <div className="text-center py-8 text-slate-500">Loading verifications...</div>;
        }

        return (
            <div className="space-y-6">
                {/* Organization Verifications */}
                <div className="space-y-3">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                        Organization Verifications
                        {pendingVerifications.organizations.length > 0 && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
                                {pendingVerifications.organizations.length} pending
                            </span>
                        )}
                    </h2>
                    <div className="bg-white border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b">
                                <tr>
                                    <th className="px-3 py-2">Clinic</th>
                                    <th className="px-3 py-2">Email</th>
                                    <th className="px-3 py-2">KRA PIN</th>
                                    <th className="px-3 py-2">Business Reg No</th>
                                    <th className="px-3 py-2">Submitted</th>
                                    <th className="px-3 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingVerifications.organizations.map(o => (
                                    <tr key={o.id} className="border-t">
                                        <td className="px-3 py-2 font-medium">{o.name}</td>
                                        <td className="px-3 py-2 text-xs">{o.email}</td>
                                        <td className="px-3 py-2 text-xs font-mono">{o.kra_pin || '-'}</td>
                                        <td className="px-3 py-2 text-xs font-mono">{o.business_reg_no || '-'}</td>
                                        <td className="px-3 py-2 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApproveOrg(o.id)}
                                                    className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleRejectOrg(o.id)}
                                                    className="px-2 py-1 text-xs rounded border hover:bg-slate-50"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pendingVerifications.organizations.length === 0 && (
                                    <tr>
                                        <td className="px-3 py-4 text-xs text-slate-500" colSpan={6}>
                                            No pending organization verifications.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Facility Verifications */}
                <div className="space-y-3">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                        Facility Verifications
                        {pendingVerifications.facilities.length > 0 && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
                                {pendingVerifications.facilities.length} pending
                            </span>
                        )}
                    </h2>
                    <div className="bg-white border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b">
                                <tr>
                                    <th className="px-3 py-2">Location</th>
                                    <th className="px-3 py-2">Clinic</th>
                                    <th className="px-3 py-2">License No</th>
                                    <th className="px-3 py-2">Licensing Body</th>
                                    <th className="px-3 py-2">Expiry</th>
                                    <th className="px-3 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingVerifications.facilities.map(f => (
                                    <tr key={f.id} className="border-t">
                                        <td className="px-3 py-2 font-medium">{f.name}</td>
                                        <td className="px-3 py-2 text-xs">{f.clinic?.name || 'N/A'}</td>
                                        <td className="px-3 py-2 text-xs font-mono">{f.license_no || '-'}</td>
                                        <td className="px-3 py-2 text-xs">{f.licensing_body || '-'}</td>
                                        <td className="px-3 py-2 text-xs">{f.license_expiry ? new Date(f.license_expiry).toLocaleDateString() : '-'}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApproveFacility(f.clinic_id, f.id)}
                                                    className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleRejectFacility(f.clinic_id, f.id)}
                                                    className="px-2 py-1 text-xs rounded border hover:bg-slate-50"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pendingVerifications.facilities.length === 0 && (
                                    <tr>
                                        <td className="px-3 py-4 text-xs text-slate-500" colSpan={6}>
                                            No pending facility verifications.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // Audit Tab
    const AuditTab = () => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Audit Log</h2>
                <select
                    className="border rounded px-2 py-1 text-xs"
                    value={auditFilterType}
                    onChange={e => setAuditFilterType(e.target.value)}
                >
                    <option value="all">All types</option>
                    {uniqueAuditTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>
            <div className="bg-white border rounded-lg p-3 max-h-96 overflow-auto text-sm">
                {filteredAudit.map(a => (
                    <div key={a.id} className="border-b last:border-b-0 py-2">
                        <div className="font-medium">{a.type}</div>
                        <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</div>
                        <div className="text-xs text-slate-600">
                            {a.actor_name} → {a.target_name || a.target_entity}
                        </div>
                    </div>
                ))}
                {filteredAudit.length === 0 && (
                    <div className="text-xs text-slate-500">No audit entries.</div>
                )}
            </div>
        </div>
    );

    // Site Content Tab
    const SiteContentTab = () => (
        <div className="space-y-4">
            <h2 className="font-semibold text-sm">Marketing Site Content</h2>
            <div className="bg-white border rounded-lg p-4 space-y-4 text-sm">
                <div>
                    <label className="block text-xs text-slate-600 mb-1">Hero Headline</label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        value={siteContent.heroHeadline || ''}
                        onChange={e => handleUpdateSiteContent('heroHeadline', e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-600 mb-1">Bundle Blurb</label>
                    <textarea
                        className="border rounded px-3 py-2 w-full min-h-[80px]"
                        value={siteContent.bundleBlurb || ''}
                        onChange={e => handleUpdateSiteContent('bundleBlurb', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );

    // Settings Tab - Enhanced
    const SettingsTab = () => (
        <div className="space-y-6">
            {/* Billing Configuration Header Card */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        💳
                    </div>
                    <div>
                        <h2 className="font-bold text-xl">Billing Configuration</h2>
                        <p className="text-emerald-100 text-sm">Payment gateway and pricing settings</p>
                    </div>
                </div>
            </div>

            {/* Gateway Info Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Gateway Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Payment Gateway</div>
                        <div className="font-semibold text-slate-800">Pesapal</div>
                        <div className="text-xs text-slate-600 mt-1">M-Pesa + Card</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Trial Period</div>
                        <div className="font-semibold text-slate-800">14 Days</div>
                        <div className="text-xs text-slate-600 mt-1">Free trial for new clinics</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bundle Discount</div>
                        <div className="font-semibold text-slate-800">{PLAN_CONFIG.bundleDiscountPercent}% Off</div>
                        <div className="text-xs text-slate-600 mt-1">For Core + Care bundles</div>
                    </div>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Core Plans Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">
                            🏢
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Core Plans</h3>
                            <p className="text-xs text-slate-500">Staff & schedule management</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(PLAN_CONFIG.core).map(([key, cfg]) => (
                            <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 hover:from-emerald-50 hover:to-emerald-100 transition-colors border border-slate-100">
                                <div>
                                    <div className="font-semibold text-slate-800">{cfg.label}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{cfg.maxStaff} staff · {cfg.maxLocations} locations</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-emerald-600">KSh {cfg.price.toLocaleString()}</div>
                                    <div className="text-xs text-slate-400">/month</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Care Plans Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
                            💊
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Care Plans</h3>
                            <p className="text-xs text-slate-500">Healthcare compliance & docs</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(PLAN_CONFIG.care).map(([key, cfg]) => (
                            <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 hover:from-blue-50 hover:to-blue-100 transition-colors border border-slate-100">
                                <div>
                                    <div className="font-semibold text-slate-800">{cfg.label}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Unlimited staff · {cfg.maxLocations} locations</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-blue-600">KSh {cfg.price.toLocaleString()}</div>
                                    <div className="text-xs text-slate-400">/month</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    // Main content router
    const MainContent = () => {
        if (loading) {
            return <div className="text-center py-8 text-slate-500">Loading...</div>;
        }
        if (error) {
            return (
                <div className="text-center py-8">
                    <div className="text-red-600 mb-2">Error: {error}</div>
                    <button onClick={loadDashboardData} className="text-sm text-blue-600">Retry</button>
                </div>
            );
        }

        switch (activeTab) {
            case 'Dashboard': return <DashboardTab />;
            case 'Pending Onboarding': return <PendingTab />;
            case 'Clinics': return <ClinicsTab />;
            case 'Transactions': return <TransactionsTab />;
            case 'Subscriptions': return <SubscriptionsTab />;
            case 'Promos': return <PromosTab />;
            case 'Verifications': return <VerificationsTab />;
            case 'Audit': return <AuditTab />;
            case 'Site Content': return <SiteContentTab />;
            case 'Settings': return <SettingsTab />;
            default: return <DashboardTab />;
        }
    };

    // Main layout
    return (
        <div className="min-h-screen flex bg-slate-100">
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

            {/* Sidebar */}
            <aside className={`
                fixed lg:sticky top-0 left-0 z-40
                w-64 shrink-0 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col min-h-screen
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="px-6 py-5">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold">H</div>
                        <div>
                            <div className="text-white font-bold text-sm">HURE</div>
                            <div className="text-slate-400 text-xs">SuperAdmin Panel</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-3 py-4 text-sm space-y-1">
                    {[
                        { name: 'Dashboard', icon: '📊' },
                        { name: 'Pending Onboarding', icon: '⏳' },
                        { name: 'Verifications', icon: '✅' },
                        { name: 'Clinics', icon: '🏥' },
                        { name: 'Transactions', icon: '💳' },
                        { name: 'Subscriptions', icon: '📋' },
                        { name: 'Promos', icon: '🎁' },
                        { name: 'Audit', icon: '📝' },
                        { name: 'Site Content', icon: '📄' },
                        { name: 'Settings', icon: '⚙️' }
                    ].map(tab => (
                        <button
                            key={tab.name}
                            onClick={() => { setActiveTab(tab.name); setSidebarOpen(false); }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.name
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                                }`}
                        >
                            <span className="mr-3">{tab.icon}</span>
                            {tab.name}
                        </button>
                    ))}
                </nav>
                <div className="px-4 py-4 border-t border-slate-700">
                    <button
                        onClick={() => { api.logout(); setIsAuthenticated(false); window.location.href = '/'; }}
                        className="w-full text-left px-4 py-2 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                    >
                        🚪 Logout
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 bg-slate-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{activeTab}</h1>
                        <div className="text-sm text-slate-500 mt-1">
                            Manage your platform with ease
                        </div>
                    </div>
                    <button
                        onClick={loadDashboardData}
                        className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                    >
                        🔄 Refresh Data
                    </button>
                </div>
                <MainContent />
            </main>
        </div>
    );
}
