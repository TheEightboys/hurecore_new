import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Homepage Component - Enhanced with GSAP animations
 */
export default function Homepage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);

    // Refs for GSAP animations
    const heroRef = useRef(null);
    const featuresRef = useRef(null);
    const aboutRef = useRef(null);
    const testimonialsRef = useRef(null);
    const faqRef = useRef(null);

    useEffect(() => {
        // Hero animation
        gsap.fromTo(heroRef.current?.querySelectorAll('.animate-hero'),
            { opacity: 0, y: 50 },
            { opacity: 1, y: 0, duration: 0.8, stagger: 0.2, ease: 'power3.out' }
        );

        // Features animation
        gsap.fromTo(featuresRef.current?.querySelectorAll('.feature-card'),
            { opacity: 0, y: 60 },
            {
                opacity: 1, y: 0, duration: 0.6, stagger: 0.15,
                scrollTrigger: { trigger: featuresRef.current, start: 'top 80%' }
            }
        );

        // About section animation
        gsap.fromTo(aboutRef.current?.querySelectorAll('.about-item'),
            { opacity: 0, x: -40 },
            {
                opacity: 1, x: 0, duration: 0.6, stagger: 0.2,
                scrollTrigger: { trigger: aboutRef.current, start: 'top 80%' }
            }
        );

        // Testimonials animation
        gsap.fromTo(testimonialsRef.current?.querySelectorAll('.testimonial-card'),
            { opacity: 0, scale: 0.9 },
            {
                opacity: 1, scale: 1, duration: 0.5, stagger: 0.15,
                scrollTrigger: { trigger: testimonialsRef.current, start: 'top 80%' }
            }
        );

        // FAQ animation
        gsap.fromTo(faqRef.current?.querySelectorAll('.faq-item'),
            { opacity: 0, y: 30 },
            {
                opacity: 1, y: 0, duration: 0.4, stagger: 0.1,
                scrollTrigger: { trigger: faqRef.current, start: 'top 80%' }
            }
        );

        return () => ScrollTrigger.getAll().forEach(t => t.kill());
    }, []);

    const handleGetStarted = () => window.location.href = '/onboard';
    const handleSuperAdminLogin = () => window.location.href = '/admin';
    const handleEmployerLogin = () => window.location.href = '/login';
    const handleEmployeeLogin = () => window.location.href = '/employee/login';

    const testimonials = [
        { name: 'Dr. Sarah Chen', role: 'Clinic Director, MediCare Plus', avatar: 'S', text: 'HURE Core transformed how we manage our 50+ staff. Scheduling is now effortless and compliance tracking saves us hours every week.' },
        { name: 'James Mwangi', role: 'HR Manager, HealthFirst', avatar: 'J', text: 'The multi-location support is fantastic. We manage 3 clinics from one dashboard. Staff love the mobile clock-in feature.' },
        { name: 'Dr. Priya Sharma', role: 'Medical Director', avatar: 'P', text: 'License expiry alerts have been a lifesaver. We never miss renewals now. The onboarding process was incredibly smooth.' },
        { name: 'Michael Otieno', role: 'Operations Lead', avatar: 'M', text: 'Finally, a system that understands healthcare staffing. The coverage-first scheduling model is exactly what we needed.' }
    ];

    const faqs = [
        { q: 'How does the multi-tenant system work?', a: 'Each organization gets their own isolated workspace with separate staff, schedules, and data. SuperAdmins can manage multiple organizations from a single dashboard.' },
        { q: 'Can staff access the system on mobile?', a: 'Yes! Staff can clock in/out, view schedules, request leave, and access documents from any device. The interface is fully responsive.' },
        { q: 'How does license tracking work?', a: 'HURE Core automatically tracks license expiry dates and sends reminders 30 days before expiration. Admins get alerts for expired or expiring licenses.' },
        { q: 'Is there a free trial available?', a: 'Yes, you can start with our free plan for small teams. Upgrade anytime to access advanced features like multi-location support and payroll.' },
        { q: 'How secure is my data?', a: 'We use industry-standard encryption, secure authentication, and your data is hosted on enterprise-grade infrastructure with regular backups.' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">H</span>
                        </div>
                        <span className="text-white font-bold text-xl sm:text-2xl">HURE</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                        </svg>
                    </button>
                    <div className="hidden md:flex items-center gap-4">
                        <button onClick={handleEmployeeLogin} className="text-slate-300 hover:text-white text-sm font-medium">Staff Login</button>
                        <button onClick={handleEmployerLogin} className="text-slate-300 hover:text-white text-sm font-medium">Employer Login</button>
                        <button onClick={handleSuperAdminLogin} className="px-4 py-2 bg-slate-800/50 text-emerald-400 rounded-lg text-sm font-medium border border-emerald-500/30">SuperAdmin</button>
                    </div>
                </div>
                {mobileMenuOpen && (
                    <div className="md:hidden bg-slate-900 border-t border-slate-700/50 px-4 py-4 space-y-3">
                        <button onClick={handleEmployeeLogin} className="block w-full text-left text-slate-300 py-3 px-2 hover:bg-slate-800 rounded">Staff Login</button>
                        <button onClick={handleEmployerLogin} className="block w-full text-left text-slate-300 py-3 px-2 hover:bg-slate-800 rounded">Employer Login</button>
                        <button onClick={handleSuperAdminLogin} className="block w-full text-center px-4 py-3 bg-slate-800 text-emerald-400 rounded-lg border border-emerald-500/30">SuperAdmin</button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <div ref={heroRef} className="min-h-screen flex items-center justify-center px-4 pt-24">
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px]" />
                    </div>
                    <div className="animate-hero hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-10">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        Multi-Tenant Staff Management Platform
                    </div>
                    <h1 className="animate-hero text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-8 leading-tight">
                        <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Hure Core</span>
                        <span className="block text-xl sm:text-3xl md:text-4xl mt-4 text-slate-300 font-medium">Multi-Tenant Staff Management</span>
                    </h1>
                    <p className="animate-hero text-base sm:text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed px-4">
                        HURE Core streamlines staff management, scheduling, attendance tracking, and compliance for organizations of all sizes.
                    </p>
                    <div className="animate-hero flex flex-col sm:flex-row gap-5 justify-center items-center">
                        <button onClick={handleGetStarted} className="group px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 transition-all">
                            Get Started <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                        <button onClick={handleEmployerLogin} className="px-10 py-4 bg-white/5 text-white rounded-xl font-semibold text-lg border border-white/10 hover:bg-white/10 transition-all">Sign In to Dashboard</button>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div ref={featuresRef} className="py-24 px-6 bg-slate-900/50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-4">Everything You Need to Manage Your Team</h2>
                    <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">From onboarding to scheduling, HURE Core provides comprehensive tools for modern workforce management.</p>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: '👥', title: 'Staff Management', desc: 'Easily onboard, manage, and track your staff with comprehensive profiles and credentials.' },
                            { icon: '📅', title: 'Smart Scheduling', desc: 'Create and manage shifts with intelligent scheduling that considers availability and compliance.' },
                            { icon: '🛡️', title: 'Compliance Tracking', desc: 'Stay compliant with automated license tracking and KYC verification for all staff members.' }
                        ].map((f, i) => (
                            <div key={i} className="feature-card p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 text-2xl">{f.icon}</div>
                                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                                <p className="text-slate-400 text-sm">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* About Section */}
            <div ref={aboutRef} className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-4">Why Choose HURE Core?</h2>
                    <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">Built specifically for healthcare and service organizations that need reliable staff management.</p>
                    <div className="grid md:grid-cols-2 gap-8">
                        {[
                            { icon: '🏥', title: 'Multi-Location Support', desc: 'Manage multiple clinics or branches from a single dashboard with location-based scheduling.' },
                            { icon: '⏱️', title: 'Real-Time Attendance', desc: 'Track clock-ins and outs in real-time with automatic hour calculations and overtime tracking.' },
                            { icon: '📄', title: 'Document Management', desc: 'Store and share policies, licenses, and compliance documents securely with your team.' },
                            { icon: '💰', title: 'Payroll Integration', desc: 'Generate payroll reports based on attendance data with support for hourly and salaried staff.' }
                        ].map((item, i) => (
                            <div key={i} className="about-item flex gap-4 p-6 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                <div className="text-3xl">{item.icon}</div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                                    <p className="text-slate-400 text-sm">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Testimonials Section */}
            <div ref={testimonialsRef} className="py-24 px-6 bg-slate-900/50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-4">Loved by Healthcare Teams</h2>
                    <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">See what our customers have to say about HURE Core.</p>
                    <div className="grid md:grid-cols-2 gap-6">
                        {testimonials.map((t, i) => (
                            <div key={i} className="testimonial-card p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                                <p className="text-slate-300 mb-4 italic">"{t.text}"</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">{t.avatar}</div>
                                    <div>
                                        <div className="text-white font-medium">{t.name}</div>
                                        <div className="text-slate-500 text-sm">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div ref={faqRef} className="py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-4">Frequently Asked Questions</h2>
                    <p className="text-slate-400 text-center mb-12">Everything you need to know about HURE Core.</p>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <div key={i} className="faq-item border border-slate-700/50 rounded-xl overflow-hidden">
                                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full p-5 text-left flex justify-between items-center bg-slate-800/30 hover:bg-slate-800/50 transition">
                                    <span className="text-white font-medium">{faq.q}</span>
                                    <span className={`text-emerald-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>▼</span>
                                </button>
                                {openFaq === i && <div className="p-5 text-slate-400 bg-slate-800/20">{faq.a}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="py-24 px-6 bg-gradient-to-r from-emerald-600 to-teal-600">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Transform Your Workforce Management?</h2>
                    <p className="text-emerald-100 mb-8 text-lg">Join hundreds of organizations already using HURE Core.</p>
                    <button onClick={handleGetStarted} className="px-10 py-4 bg-white text-emerald-600 rounded-xl font-bold text-lg hover:bg-emerald-50 transition-all hover:scale-105 shadow-lg">
                        Start Free Trial →
                    </button>
                </div>
            </div>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-slate-800 bg-slate-900">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><span className="text-white font-bold">H</span></div>
                                <span className="text-white font-bold">HURE Core</span>
                            </div>
                            <p className="text-slate-500 text-sm">Multi-tenant staff management for modern organizations.</p>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Product</h4>
                            <div className="space-y-2 text-slate-500 text-sm">
                                <div className="hover:text-emerald-400 cursor-pointer">Features</div>
                                <div className="hover:text-emerald-400 cursor-pointer">Pricing</div>
                                <div className="hover:text-emerald-400 cursor-pointer">Integrations</div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Company</h4>
                            <div className="space-y-2 text-slate-500 text-sm">
                                <div className="hover:text-emerald-400 cursor-pointer">About</div>
                                <div className="hover:text-emerald-400 cursor-pointer">Blog</div>
                                <div className="hover:text-emerald-400 cursor-pointer">Careers</div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Legal</h4>
                            <div className="space-y-2 text-slate-500 text-sm">
                                <div className="hover:text-emerald-400 cursor-pointer">Privacy</div>
                                <div className="hover:text-emerald-400 cursor-pointer">Terms</div>
                                <div className="hover:text-emerald-400 cursor-pointer">Contact</div>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-slate-800 pt-8 text-center text-slate-500 text-sm">
                        © 2024 HURE Core. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}

