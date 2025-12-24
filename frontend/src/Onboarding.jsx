import React, { useState } from 'react';
import { PLAN_CONFIG, calculateBundlePrice, getPlanLabel } from './plans';

/**
 * Onboarding Wizard
 * Multi-step flow for new clinic registration
 */
export default function Onboarding() {
    // Get initial state from URL params
    const params = new URLSearchParams(window.location.search);
    const initialProduct = params.get('product') || 'core';
    const initialPlan = params.get('plan') || 'essential';

    // State
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [clinicId, setClinicId] = useState(null);

    // Form data - individual state for each field to prevent re-render issues
    const [product, setProduct] = useState(initialProduct);
    const [plan, setPlan] = useState(initialPlan);
    const [name, setName] = useState('');
    const [town, setTown] = useState('');
    const [country, setCountry] = useState('Kenya');
    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [businessLicense, setBusinessLicense] = useState('');
    const [tempPassword, setTempPassword] = useState('');
    const [confirmTempPassword, setConfirmTempPassword] = useState('');
    const [otp, setOtp] = useState('');

    // Computed values
    const modules = product === 'bundle' ? ['core', 'care'] : [product];
    const isBundle = product === 'bundle';
    const pricing = isBundle
        ? calculateBundlePrice(plan)
        : { final: PLAN_CONFIG[product]?.[plan]?.price || 0 };

    // Clear error on any change
    const clearError = () => setError('');

    // Step 1: Submit product selection
    const handleProductNext = () => {
        if (!product || !plan) {
            setError('Please select a product and plan');
            return;
        }
        setStep(2);
    };

    // Step 2: Submit business details
    const handleBusinessSubmit = async () => {
        if (!name || !email || !phone || !contactName) {
            setError('Please fill all required fields');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/onboard/clinic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, town, country, contactName, email, phone, businessLicense,
                    modules,
                    planKey: plan,
                    planProduct: product === 'bundle' ? 'core' : product
                })
            });

            const data = await response.json();

            if (data.success) {
                setClinicId(data.clinicId);
                setStep(3);
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Submit temp password
    const handleTempPasswordSubmit = async () => {
        if (!tempPassword || !confirmTempPassword) {
            setError('Please enter password');
            return;
        }

        if (tempPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (tempPassword !== confirmTempPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/onboard/temp-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId, email, password: tempPassword })
            });

            const data = await response.json();

            if (data.success) {
                await sendOtp();
                setStep(4);
            } else {
                setError(data.error || 'Failed to set password');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Send OTP email
    const sendOtp = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/onboard/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId, email })
            });
            const data = await response.json();
            if (data.success) {
                alert('Verification code sent! Check your email.');
            } else {
                setError(data.error || 'Failed to send code');
            }
        } catch (err) {
            console.error('OTP send error:', err);
            setError('Failed to send verification code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Verify OTP
    const handleOtpSubmit = async () => {
        if (!otp || otp.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/onboard/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId, code: otp })
            });

            const data = await response.json();

            if (data.success) {
                setStep(5);
            } else {
                setError(data.error || 'Invalid code');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Payment handler
    const handlePayment = () => {
        alert('Payment integration coming soon! For now, contact admin to activate your account.');
    };

    // Skip Payment (Dev Mode)
    const handleSkipPayment = async () => {
        if (!confirm('Dev Mode: Skip payment and mark as pending activation?')) return;

        setLoading(true);
        try {
            const response = await fetch('/api/onboard/skip-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId })
            });

            const data = await response.json();

            if (data.success) {
                alert('Payment skipped! Clinic is now pending activation.');
                window.location.href = '/first-login?token=WAITING_FOR_ACTIVATION'; // Redirect to a holding page or home
            } else {
                setError(data.error || 'Failed to skip payment');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Input styling helper
    const inputClass = "w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none";

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 py-8 px-4">
            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <a href="/" className="text-emerald-700 font-bold text-2xl">HURE</a>
                    <div className="text-slate-500 text-sm">Multi-Tenant Staff Management</div>
                    <a href="/" className="inline-flex items-center gap-1 mt-3 text-sm text-emerald-600 hover:text-emerald-700 hover:underline transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Home
                    </a>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                                }`}>
                                {step > s ? '✓' : s}
                            </div>
                            {s < 5 && <div className={`w-8 h-1 ${step > s ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>

                {/* Card */}
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {/* Step 1: Product Selection */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-slate-800">Choose Your Plan</h2>
                                <p className="text-slate-500 text-sm mt-1">Select the product that fits your clinic</p>
                            </div>

                            <div className="flex rounded-lg bg-slate-100 p-1">
                                {['core', 'care', 'bundle'].map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => { setProduct(p); clearError(); }}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${product === p ? 'bg-white shadow text-emerald-700' : 'text-slate-600 hover:text-slate-800'
                                            }`}
                                    >
                                        {p === 'bundle' ? 'Core + Care' : `HURE ${p.charAt(0).toUpperCase() + p.slice(1)}`}
                                    </button>
                                ))}
                            </div>

                            {isBundle && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
                                    🎉 Bundle saves you <strong>20%</strong> every month!
                                </div>
                            )}

                            <div className="space-y-3">
                                {Object.entries(PLAN_CONFIG[product === 'bundle' ? 'core' : product] || {}).map(([key, planConfig]) => {
                                    const bundlePrice = isBundle ? calculateBundlePrice(key) : null;
                                    const price = isBundle ? bundlePrice.final : planConfig.price;

                                    return (
                                        <label key={key} className={`block border rounded-lg p-4 cursor-pointer transition ${plan === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                                            }`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="plan"
                                                        checked={plan === key}
                                                        onChange={() => { setPlan(key); clearError(); }}
                                                        className="text-emerald-600"
                                                    />
                                                    <div>
                                                        <div className="font-medium text-slate-800">{planConfig.label}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {planConfig.maxStaff === Infinity ? 'Unlimited' : `Up to ${planConfig.maxStaff}`} staff
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-lg text-slate-800">KSh {price.toLocaleString()}</div>
                                                    <div className="text-xs text-slate-500">/month</div>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <button onClick={handleProductNext} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">
                                Continue
                            </button>
                        </div>
                    )}

                    {/* Step 2: Business Details */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Business Details</h2>
                                <p className="text-slate-500 text-sm mt-1">Tell us about your clinic</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Clinic Name *</label>
                                    <input type="text" value={name} onChange={e => { setName(e.target.value); clearError(); }}
                                        className={inputClass} placeholder="e.g. Nairobi Medical Centre" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person *</label>
                                        <input type="text" value={contactName} onChange={e => { setContactName(e.target.value); clearError(); }}
                                            className={inputClass} placeholder="Full name" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                        <input type="email" value={email} onChange={e => { setEmail(e.target.value); clearError(); }}
                                            className={inputClass} placeholder="your@email.com" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                                        <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); clearError(); }}
                                            className={inputClass} placeholder="+254 7XX XXX XXX" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Town/City</label>
                                        <input type="text" value={town} onChange={e => setTown(e.target.value)}
                                            className={inputClass} placeholder="e.g. Nairobi" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                                        <select value={country} onChange={e => setCountry(e.target.value)} className={inputClass}>
                                            <option value="Kenya">Kenya</option>
                                            <option value="Uganda">Uganda</option>
                                            <option value="Tanzania">Tanzania</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Business License</label>
                                        <input type="text" value={businessLicense} onChange={e => setBusinessLicense(e.target.value)}
                                            className={inputClass} placeholder="Optional" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50">
                                    Back
                                </button>
                                <button onClick={handleBusinessSubmit} disabled={loading}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                                    {loading ? 'Submitting...' : 'Continue'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Temp Password */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Create Temporary Password</h2>
                                <p className="text-slate-500 text-sm mt-1">You'll set your permanent password after activation</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                                <input type="password" value={tempPassword} onChange={e => { setTempPassword(e.target.value); clearError(); }}
                                    className={inputClass} placeholder="At least 6 characters" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                                <input type="password" value={confirmTempPassword} onChange={e => { setConfirmTempPassword(e.target.value); clearError(); }}
                                    className={inputClass} placeholder="Re-enter password" />
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                                💡 Remember this password! You'll need it to complete setup later.
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50">
                                    Back
                                </button>
                                <button onClick={handleTempPasswordSubmit} disabled={loading}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Continue'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: OTP Verification */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Verify Your Email</h2>
                                <p className="text-slate-500 text-sm mt-1">We sent a 6-digit code to <strong>{email}</strong></p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Verification Code</label>
                                <input type="text" value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError(); }}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-emerald-500"
                                    placeholder="000000" maxLength={6} />
                            </div>

                            <button onClick={sendOtp} type="button" className="text-sm text-emerald-600 hover:underline">
                                Didn't receive code? Resend
                            </button>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setStep(3)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50">
                                    Back
                                </button>
                                <button onClick={handleOtpSubmit} disabled={loading}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                                    {loading ? 'Verifying...' : 'Verify'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Payment */}
                    {step === 5 && (
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Complete Payment</h2>
                                <p className="text-slate-500 text-sm mt-1">Almost there! Pay to activate your account.</p>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Product</span>
                                    <span className="font-medium">{product === 'bundle' ? 'Core + Care Bundle' : `HURE ${product}`}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Plan</span>
                                    <span className="font-medium">{getPlanLabel(product === 'bundle' ? 'core' : product, plan)}</span>
                                </div>
                                {isBundle && (
                                    <div className="flex justify-between text-sm text-emerald-600">
                                        <span>Bundle Discount</span>
                                        <span>-20%</span>
                                    </div>
                                )}
                                <div className="border-t pt-3 flex justify-between">
                                    <span className="font-medium">Total</span>
                                    <span className="text-xl font-bold text-emerald-600">KSh {pricing.final.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handlePayment} className="py-4 border-2 border-slate-200 rounded-lg hover:border-emerald-500 transition text-center">
                                    <div className="text-2xl mb-1">📱</div>
                                    <div className="font-medium">M-Pesa</div>
                                </button>
                                <button onClick={handlePayment} className="py-4 border-2 border-slate-200 rounded-lg hover:border-emerald-500 transition text-center">
                                    <div className="text-2xl mb-1">💳</div>
                                    <div className="font-medium">Card</div>
                                </button>
                            </div>

                            {/* Skip Payment Button (Dev Mode) */}
                            <button
                                onClick={handleSkipPayment}
                                disabled={loading}
                                className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition"
                            >
                                {loading ? 'Processing...' : 'Wait for payment later (Dev Mode: Skip)'}
                            </button>

                            <p className="text-xs text-slate-500 text-center">Secure payment powered by Pesapal</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-sm text-slate-500">
                    Already have an account? <a href="/login" className="text-emerald-600 hover:underline">Sign in</a>
                </div>
            </div>
        </div>
    );
}
