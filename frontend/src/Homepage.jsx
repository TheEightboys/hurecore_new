import React from 'react';

/**
 * Homepage Component
 * Landing page with two pathways:
 * 1. SuperAdmin Login -> Admin Dashboard
 * 2. Get Started -> Clinic Onboarding
 */
export default function Homepage() {
    const handleGetStarted = () => {
        window.location.href = '/onboard';
    };

    const handleSuperAdminLogin = () => {
        window.location.href = '/admin';
    };

    const handleEmployerLogin = () => {
        window.location.href = '/login';
    };

    const handleEmployeeLogin = () => {
        window.location.href = '/employee/login';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
            {/* Navigation */}
            <nav className="absolute top-0 left-0 right-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">H</span>
                        </div>
                        <span className="text-white font-bold text-2xl tracking-tight">HURE</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleEmployeeLogin}
                            className="text-slate-300 hover:text-white transition text-sm font-medium"
                        >
                            Staff Login
                        </button>
                        <button
                            onClick={handleEmployerLogin}
                            className="text-slate-300 hover:text-white transition text-sm font-medium"
                        >
                            Employer Login
                        </button>
                        <button
                            onClick={handleSuperAdminLogin}
                            className="px-4 py-2 bg-slate-800/50 text-emerald-400 rounded-lg text-sm font-medium hover:bg-slate-700/50 transition border border-emerald-500/30"
                        >
                            SuperAdmin
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Glowing orb effect */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px]" />
                    </div>

                    <div className="relative z-10">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            Multi-Tenant Staff Management Platform
                        </div>

                        {/* Headline */}
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                            <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                                Hure Core
                            </span>
                            <span className="block text-3xl md:text-4xl mt-2 text-slate-300 font-medium">
                                Multi-Tenant Staff Management
                            </span>
                        </h1>

                        {/* Subheadline */}
                        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                            HURE Core streamlines staff management, scheduling, attendance tracking,
                            and compliance for organizations of all sizes.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button
                                onClick={handleGetStarted}
                                className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all hover:scale-105"
                            >
                                Get Started
                                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                            <button
                                onClick={handleEmployerLogin}
                                className="px-8 py-4 bg-white/5 text-white rounded-xl font-semibold text-lg border border-white/10 hover:bg-white/10 transition-all"
                            >
                                Sign In to Dashboard
                            </button>
                        </div>

                        {/* Trust badges */}
                        <div className="mt-16 flex flex-wrap justify-center items-center gap-8 text-slate-500 text-sm">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Multi-Tenant</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Real-time Tracking</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Secure & Reliable</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="py-24 px-6 bg-slate-900/50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-4">
                        Everything You Need to Manage Your Team
                    </h2>
                    <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
                        From onboarding to scheduling, HURE Core provides comprehensive tools for modern workforce management.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Staff Management</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Easily onboard, manage, and track your staff with comprehensive profiles and credentials.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Smart Scheduling</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Create and manage shifts with intelligent scheduling that considers availability and compliance.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Compliance Tracking</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Stay compliant with automated license tracking and KYC verification for all staff members.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-slate-800">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold">H</span>
                        </div>
                        <span className="text-slate-400 text-sm">© 2024 HURE. All rights reserved.</span>
                    </div>
                    <div className="flex gap-6 text-slate-500 text-sm">
                        <a href="#" className="hover:text-emerald-400 transition">Privacy</a>
                        <a href="#" className="hover:text-emerald-400 transition">Terms</a>
                        <a href="#" className="hover:text-emerald-400 transition">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
