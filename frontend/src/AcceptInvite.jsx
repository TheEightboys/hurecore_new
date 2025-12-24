import { useState, useEffect } from 'react';
import { verifyInvite, acceptInvite, setStaffToken } from './employeeApi';

export default function AcceptInvite() {
    // Parse token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inviteData, setInviteData] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Invalid invitation link');
            setLoading(false);
            return;
        }

        // Verify the invite token
        verifyInvite(token)
            .then(data => {
                setInviteData(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message || 'Invalid or expired invitation');
                setLoading(false);
            });
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setSubmitting(true);

        try {
            const result = await acceptInvite(token, password);
            setStaffToken(result.token);
            // Navigate to employee dashboard
            window.location.href = '/employee';
        } catch (err) {
            setError(err.message || 'Failed to accept invitation');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Verifying invitation...</p>
                </div>
            </div>
        );
    }

    if (error && !inviteData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
                    <div className="text-red-500 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Invitation</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to HURE!</h1>
                    <p className="text-gray-600">
                        You've been invited to join <span className="font-semibold">{inviteData?.staff?.clinic?.name}</span>
                    </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-700">
                        <span className="font-semibold">Name:</span> {inviteData?.staff?.name}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                        <span className="font-semibold">Email:</span> {inviteData?.staff?.email}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                        <span className="font-semibold">Role:</span> {inviteData?.staff?.jobRole}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Create Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Minimum 8 characters"
                            required
                            disabled={submitting}
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Re-enter password"
                            required
                            disabled={submitting}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Setting up your account...' : 'Complete Setup & Sign In'}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-gray-500">
                    By continuing, you agree to HURE's Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    );
}
