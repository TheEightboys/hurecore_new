/**
 * HURE Core - Employer Portal API Client
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Get auth token from localStorage
function getToken() {
    return localStorage.getItem('hure_auth_token');
}

// Get current clinic ID from localStorage
function getClinicId() {
    return localStorage.getItem('hure_clinic_id');
}

// Generic fetch wrapper with auth
async function fetchAPI(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
}

// ============================================
// STAFF API
// ============================================

export const staffAPI = {
    list: (clinicId, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/clinics/${clinicId}/staff${query ? `?${query}` : ''}`);
    },

    get: (clinicId, staffId) => {
        return fetchAPI(`/clinics/${clinicId}/staff/${staffId}`);
    },

    create: (clinicId, data) => {
        return fetchAPI(`/clinics/${clinicId}/staff`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: (clinicId, staffId, data) => {
        return fetchAPI(`/clinics/${clinicId}/staff/${staffId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    delete: (clinicId, staffId) => {
        return fetchAPI(`/clinics/${clinicId}/staff/${staffId}`, {
            method: 'DELETE',
        });
    },

    sendInvite: (clinicId, staffId, method = 'email') => {
        return fetchAPI(`/clinics/${clinicId}/staff/${staffId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ method }),
        });
    },

    revokeInvite: (clinicId, staffId) => {
        return fetchAPI(`/clinics/${clinicId}/staff/${staffId}/invite`, {
            method: 'DELETE',
        });
    },

    updateKyc: (clinicId, staffId, status) => {
        return fetchAPI(`/clinics/${clinicId}/staff/${staffId}/kyc`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    },
};

// ============================================
// SHIFTS API
// ============================================

export const shiftsAPI = {
    list: (clinicId, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/clinics/${clinicId}/shifts${query ? `?${query}` : ''}`);
    },

    get: (clinicId, shiftId) => {
        return fetchAPI(`/clinics/${clinicId}/shifts/${shiftId}`);
    },

    create: (clinicId, data) => {
        return fetchAPI(`/clinics/${clinicId}/shifts`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: (clinicId, shiftId, data) => {
        return fetchAPI(`/clinics/${clinicId}/shifts/${shiftId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    assign: (clinicId, shiftId, staffId) => {
        return fetchAPI(`/clinics/${clinicId}/shifts/${shiftId}/assign`, {
            method: 'PATCH',
            body: JSON.stringify({ staffId }),
        });
    },

    delete: (clinicId, shiftId) => {
        return fetchAPI(`/clinics/${clinicId}/shifts/${shiftId}`, {
            method: 'DELETE',
        });
    },
};

// ============================================
// ATTENDANCE API
// ============================================

export const attendanceAPI = {
    list: (clinicId, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/clinics/${clinicId}/attendance${query ? `?${query}` : ''}`);
    },

    clockIn: (clinicId, staffId, method = 'manual', locationId = null) => {
        return fetchAPI(`/clinics/${clinicId}/attendance/clock-in`, {
            method: 'POST',
            body: JSON.stringify({ staffId, method, locationId }),
        });
    },

    clockOut: (clinicId, staffId, method = 'manual') => {
        return fetchAPI(`/clinics/${clinicId}/attendance/clock-out`, {
            method: 'POST',
            body: JSON.stringify({ staffId, method }),
        });
    },

    summary: (clinicId, from, to) => {
        return fetchAPI(`/clinics/${clinicId}/attendance/summary?from=${from}&to=${to}`);
    },

    exportUrl: (clinicId, from, to) => {
        return `${API_BASE}/clinics/${clinicId}/attendance/export?from=${from}&to=${to}`;
    },
};

// ============================================
// LEAVE API
// ============================================

export const leaveAPI = {
    list: (clinicId, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/clinics/${clinicId}/leave${query ? `?${query}` : ''}`);
    },

    get: (clinicId, leaveId) => {
        return fetchAPI(`/clinics/${clinicId}/leave/${leaveId}`);
    },

    create: (clinicId, data) => {
        return fetchAPI(`/clinics/${clinicId}/leave`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    approve: (clinicId, leaveId, reviewerId) => {
        return fetchAPI(`/clinics/${clinicId}/leave/${leaveId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'approved', reviewerId }),
        });
    },

    reject: (clinicId, leaveId, reviewerId, rejectionReason) => {
        return fetchAPI(`/clinics/${clinicId}/leave/${leaveId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'rejected', reviewerId, rejectionReason }),
        });
    },

    cancel: (clinicId, leaveId) => {
        return fetchAPI(`/clinics/${clinicId}/leave/${leaveId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'cancelled' }),
        });
    },
};

// ============================================
// LOCATIONS API
// ============================================

export const locationsAPI = {
    list: (clinicId) => {
        return fetchAPI(`/clinics/${clinicId}/locations`);
    },

    create: (clinicId, data) => {
        return fetchAPI(`/clinics/${clinicId}/locations`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: (clinicId, locationId, data) => {
        return fetchAPI(`/clinics/${clinicId}/locations/${locationId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    delete: (clinicId, locationId) => {
        return fetchAPI(`/clinics/${clinicId}/locations/${locationId}`, {
            method: 'DELETE',
        });
    },
};

// ============================================
// SETTINGS API
// ============================================

export const settingsAPI = {
    get: (clinicId) => {
        return fetchAPI(`/clinics/${clinicId}/settings`);
    },

    update: (clinicId, data) => {
        return fetchAPI(`/clinics/${clinicId}/settings`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },
};

// Export helper functions
export { getToken, getClinicId };
