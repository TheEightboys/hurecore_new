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

// ============================================
// SCHEDULE BLOCKS API (Coverage-first model)
// ============================================

export const scheduleBlocksAPI = {
    list: (clinicId, locationId = null) => {
        const params = locationId && locationId !== 'ALL' ? `?location=${locationId}` : '';
        return fetchAPI(`/employer/${clinicId}/schedule-blocks${params}`);
    },

    create: (clinicId, data) => {
        return fetchAPI(`/employer/${clinicId}/schedule-blocks`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: (clinicId, blockId, data) => {
        return fetchAPI(`/employer/${clinicId}/schedule-blocks/${blockId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: (clinicId, blockId) => {
        return fetchAPI(`/employer/${clinicId}/schedule-blocks/${blockId}`, {
            method: 'DELETE',
        });
    },

    assignStaff: (clinicId, blockId, staffId, action = 'add') => {
        return fetchAPI(`/employer/${clinicId}/schedule-blocks/${blockId}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ staff_id: staffId, action }),
        });
    },

    manageLocum: (clinicId, blockId, { action, locum, locum_id }) => {
        return fetchAPI(`/employer/${clinicId}/schedule-blocks/${blockId}/locum`, {
            method: 'PUT',
            body: JSON.stringify({ action, locum, locum_id }),
        });
    },
};

// ============================================
// PAYROLL API
// ============================================

export const payrollAPI = {
    list: (clinicId, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI(`/employer/${clinicId}/payroll${query ? `?${query}` : ''}`);
    },

    upsert: (clinicId, data) => {
        return fetchAPI(`/employer/${clinicId}/payroll`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    updateStatus: (clinicId, payrollKey, status) => {
        return fetchAPI(`/employer/${clinicId}/payroll/${encodeURIComponent(payrollKey)}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    },

    bulkUpdateStatus: (clinicId, payrollKeys, status) => {
        return fetchAPI(`/employer/${clinicId}/payroll/bulk-status`, {
            method: 'PUT',
            body: JSON.stringify({ payroll_keys: payrollKeys, status }),
        });
    },
};

// ============================================
// VERIFICATION API
// ============================================

export const verificationAPI = {
    getOrg: (clinicId) => {
        return fetchAPI(`/employer/${clinicId}/org-verification`);
    },

    updateOrg: (clinicId, data) => {
        return fetchAPI(`/employer/${clinicId}/org-verification`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    getFacility: (clinicId, locationId) => {
        return fetchAPI(`/employer/${clinicId}/locations/${locationId}/verification`);
    },

    updateFacility: (clinicId, locationId, data) => {
        return fetchAPI(`/employer/${clinicId}/locations/${locationId}/verification`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};

// ============================================
// AUDIT LOG API
// ============================================

export const auditAPI = {
    list: (clinicId, locationId = null, limit = 100) => {
        const params = new URLSearchParams({ limit });
        if (locationId && locationId !== 'ALL') {
            params.set('location', locationId);
        }
        return fetchAPI(`/employer/${clinicId}/audit?${params.toString()}`);
    },

    add: (clinicId, data) => {
        return fetchAPI(`/employer/${clinicId}/audit`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};

// ============================================
// DOCUMENTS API
// ============================================

export const documentsAPI = {
    list: (clinicId, category = null) => {
        const params = category && category !== 'all' ? `?category=${category}` : '';
        return fetchAPI(`/employer/${clinicId}/documents${params}`);
    },

    upload: async (clinicId, file, metadata = {}) => {
        // Convert file to base64
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        return fetchAPI(`/employer/${clinicId}/documents`, {
            method: 'POST',
            body: JSON.stringify({
                name: metadata.name || file.name,
                fileName: file.name,
                fileData: base64,
                fileType: file.type,
                fileSize: file.size,
                category: metadata.category || 'other',
                uploadedBy: metadata.uploadedBy,
                uploadedByName: metadata.uploadedByName || 'Unknown',
            }),
        });
    },

    get: (clinicId, docId) => {
        return fetchAPI(`/employer/${clinicId}/documents/${docId}`);
    },

    getDownloadUrl: (clinicId, docId) => {
        return fetchAPI(`/employer/${clinicId}/documents/${docId}/download`);
    },

    delete: (clinicId, docId) => {
        return fetchAPI(`/employer/${clinicId}/documents/${docId}`, {
            method: 'DELETE',
        });
    },
};

// Export helper functions
export { getToken, getClinicId };

