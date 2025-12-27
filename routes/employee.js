/**
 * HURE Core - Employee/Staff Routes
 * Handles staff portal access: schedule, attendance, leave, documents
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { verifyToken } = require('../lib/auth');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');

/**
 * Middleware: Verify staff authentication
 */
async function requireStaff(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Staff must have staffId in token
    if (!decoded.staffId) {
        return res.status(403).json({ error: 'Staff access required' });
    }

    req.user = decoded;
    next();
}

/**
 * GET /api/employee/profile
 * Get staff member's own profile
 */
router.get('/profile', requireStaff, async (req, res) => {
    try {
        // First get staff with clinic
        const { data: staff, error } = await supabaseAdmin
            .from('staff')
            .select(`
                *,
                clinic:clinics(id, name, town, country)
            `)
            .eq('id', req.user.staffId)
            .single();

        if (error || !staff) {
            console.error('Staff query error:', error);
            return res.status(404).json({ error: 'Staff profile not found' });
        }

        // Get location separately if location_id exists
        let locationName = null;
        if (staff.location_id) {
            const { data: location } = await supabaseAdmin
                .from('clinic_locations')
                .select('name')
                .eq('id', staff.location_id)
                .single();
            locationName = location?.name;
        }

        // Add clinic and location names for display
        res.json({
            staff: {
                ...staff,
                clinic_name: staff.clinic?.name,
                location_name: locationName,
                role: staff.job_role
            }
        });
    } catch (err) {
        console.error('Get staff profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/employee/profile
 * Update staff member's own profile (limited fields)
 */
router.patch('/profile', requireStaff, async (req, res) => {
    try {
        const { phone, email, licenseNumber, licenseExpiry } = req.body;

        const updates = {};
        if (phone) updates.phone = phone;
        if (email) updates.email = email;
        if (licenseNumber) updates.license_number = licenseNumber;
        if (licenseExpiry) updates.license_expiry = licenseExpiry;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('staff')
            .update(updates)
            .eq('id', req.user.staffId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        res.json(data);
    } catch (err) {
        console.error('Update staff profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/schedule
 * Get staff member's assigned shifts from schedule_blocks
 */
router.get('/schedule', requireStaff, async (req, res) => {
    try {
        const { from, to } = req.query;

        // First get the staff member's details (job_role and clinic_id)
        const { data: staffData, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('job_role, clinic_id, location_id')
            .eq('id', req.user.staffId)
            .single();

        if (staffError || !staffData) {
            console.error('Staff lookup error:', staffError);
            return res.status(404).json({ error: 'Staff profile not found' });
        }

        console.log('[DEBUG] Staff schedule lookup:', {
            staffId: req.user.staffId,
            clinicId: staffData.clinic_id,
            jobRole: staffData.job_role
        });

        // Query schedule_blocks where this staff is assigned
        let blocksQuery = supabaseAdmin
            .from('schedule_blocks')
            .select('*, location:clinic_locations(name)')
            .eq('clinic_id', staffData.clinic_id)
            .contains('assigned_staff_ids', [req.user.staffId])
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        if (from) blocksQuery = blocksQuery.gte('date', from);
        if (to) blocksQuery = blocksQuery.lte('date', to);

        const { data: assignedBlocks, error: blocksError } = await blocksQuery;

        if (blocksError) {
            console.error('Schedule blocks query error:', blocksError);
            return res.status(500).json({ error: 'Failed to fetch schedule' });
        }

        console.log('[DEBUG] Schedule blocks query results:', {
            assignedCount: assignedBlocks?.length || 0,
            assignedBlocks: assignedBlocks
        });

        // Map schedule blocks to shifts for the frontend
        const shifts = (assignedBlocks || []).map(b => ({
            id: b.id,
            date: b.date,
            start_time: b.start_time,
            end_time: b.end_time,
            role: b.role_needed || 'Shift',
            location: b.location?.name || 'Main Location',
            status: 'scheduled',
            isOpenShift: false,
            decline_reason: null
        }));

        res.json({ shifts });
    } catch (err) {
        console.error('Get staff schedule error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/employee/schedule/:shiftId/respond
 * Confirm or decline a shift assignment
 */
router.patch('/schedule/:shiftId/respond', requireStaff, async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { status, reason } = req.body; // status: 'confirmed' or 'declined'

        if (!['confirmed', 'declined'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Get shift
        const { data: shift } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .eq('id', shiftId)
            .single();

        if (!shift || !shift.assigned_staff?.includes(req.user.staffId)) {
            return res.status(404).json({ error: 'Shift not found or not assigned to you' });
        }

        const updates = { updated_at: new Date().toISOString() };

        // Store response in metadata
        const responses = shift.metadata?.staff_responses || {};
        responses[req.user.staffId] = { status, reason, respondedAt: new Date().toISOString() };
        updates.metadata = { ...shift.metadata, staff_responses: responses };

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .update(updates)
            .eq('id', shiftId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update shift response' });
        }

        res.json(data);
    } catch (err) {
        console.error('Respond to shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/attendance
 * Get staff member's attendance records
 */
router.get('/attendance', requireStaff, async (req, res) => {
    try {
        const { from, to } = req.query;

        let query = supabaseAdmin
            .from('attendances')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .order('date', { ascending: false });

        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch attendance' });
        }

        // Map to expected format
        const attendance = (data || []).map(a => ({
            id: a.id,
            date: a.date,
            clock_in: a.clock_in,
            clock_out: a.clock_out,
            status: a.status
        }));

        res.json({ attendance });
    } catch (err) {
        console.error('Get attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/attendance/clock-in
 * Clock in for work
 */
router.post('/attendance/clock-in', requireStaff, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        console.log('[DEBUG] Clock-in attempt:', {
            staffId: req.user.staffId,
            clinicId: req.user.clinicId,
            today
        });

        // Get clinic_id from staff table if not in token
        let clinicId = req.user.clinicId;
        if (!clinicId) {
            const { data: staffData, error: staffError } = await supabaseAdmin
                .from('staff')
                .select('clinic_id')
                .eq('id', req.user.staffId)
                .single();

            if (staffError || !staffData) {
                console.error('Failed to get staff clinic:', staffError);
                return res.status(500).json({ error: 'Failed to get staff details' });
            }
            clinicId = staffData.clinic_id;
            console.log('[DEBUG] Got clinicId from staff table:', clinicId);
        }

        // Check if already clocked in today
        const { data: existing } = await supabaseAdmin
            .from('attendances')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .eq('clinic_id', clinicId)
            .eq('date', today)
            .is('clock_out', null)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ error: 'Already clocked in today' });
        }

        const { data, error } = await supabaseAdmin
            .from('attendances')
            .insert({
                staff_id: req.user.staffId,
                clinic_id: clinicId,
                date: today,
                clock_in: now.toISOString(),
                status: 'present'
            })
            .select()
            .single();

        if (error) {
            console.error('[DEBUG] Clock-in insert error:', error);
            return res.status(500).json({ error: 'Failed to clock in' });
        }

        console.log('[DEBUG] Clock-in successful:', data);
        res.json({ success: true, attendance: data });
    } catch (err) {
        console.error('Clock in error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/attendance/clock-out
 * Clock out from work
 */
router.post('/attendance/clock-out', requireStaff, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // Find today's active clock-in
        const { data: attendance } = await supabaseAdmin
            .from('attendances')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .eq('date', today)
            .is('clock_out', null)
            .single();

        if (!attendance) {
            return res.status(400).json({ error: 'No active clock-in found' });
        }

        // Calculate hours worked
        const clockInTime = new Date(attendance.clock_in);
        const clockOutTime = now;
        const millisecondsWorked = clockOutTime - clockInTime;
        const hoursWorked = millisecondsWorked / (1000 * 60 * 60); // Convert to hours

        // Define required hours (8 hours standard workday)
        const requiredHours = 8;
        const halfDayThreshold = requiredHours * 0.5; // 4 hours

        // Determine attendance status
        let status = 'absent';
        let overtimeHours = 0;

        if (hoursWorked >= requiredHours) {
            status = 'present';
            overtimeHours = hoursWorked - requiredHours;
        } else if (hoursWorked >= halfDayThreshold) {
            status = 'half_day';
        } else {
            status = 'absent';
        }

        const { data, error } = await supabaseAdmin
            .from('attendances')
            .update({
                clock_out: now.toISOString(),
                hours_worked: parseFloat(hoursWorked.toFixed(2)),
                status: status,
                updated_at: now.toISOString()
            })
            .eq('id', attendance.id)
            .select()
            .single();

        if (error) {
            console.error('[DEBUG] Clock-out error:', error);
            return res.status(500).json({ error: 'Failed to clock out' });
        }

        console.log('[DEBUG] Clock-out successful:', {
            hoursWorked: hoursWorked.toFixed(2),
            status,
            overtimeHours: overtimeHours.toFixed(2)
        });

        res.json({
            success: true,
            attendance: data,
            hoursWorked: parseFloat(hoursWorked.toFixed(2)),
            status,
            overtimeHours: parseFloat(overtimeHours.toFixed(2))
        });
    } catch (err) {
        console.error('Clock out error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/leave
 * Get staff member's leave requests
 */
router.get('/leave', requireStaff, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .select('*')
            .eq('staff_id', req.user.staffId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch leave requests' });
        }

        res.json({ leaves: data || [] });
    } catch (err) {
        console.error('Get leave requests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/leave
 * Submit new leave request
 */
router.post('/leave', requireStaff, async (req, res) => {
    try {
        // Accept both snake_case and camelCase field names
        const leaveType = req.body.leaveType || req.body.leave_type;
        const startDate = req.body.startDate || req.body.start_date;
        const endDate = req.body.endDate || req.body.end_date;
        const reason = req.body.reason || null;

        console.log('[DEBUG] Leave request:', { leaveType, startDate, endDate, reason });

        if (!leaveType || !startDate || !endDate) {
            return res.status(400).json({ error: 'Leave type, start date, and end date are required' });
        }

        // Get clinic_id from staff if not in token
        let clinicId = req.user.clinicId;
        if (!clinicId) {
            const { data: staffData } = await supabaseAdmin
                .from('staff')
                .select('clinic_id')
                .eq('id', req.user.staffId)
                .single();

            if (staffData) {
                clinicId = staffData.clinic_id;
            }
        }

        // Calculate days count
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .insert({
                staff_id: req.user.staffId,
                clinic_id: clinicId,
                leave_type: leaveType,
                from_date: startDate,
                to_date: endDate,
                days_count: daysCount,
                reason: reason,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('[DEBUG] Leave insert error:', error);
            return res.status(500).json({ error: 'Failed to submit leave request' });
        }

        console.log('[DEBUG] Leave request created:', data);
        res.json({ success: true, leave: data });
    } catch (err) {
        console.error('Submit leave request error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/documents
 * Get documents/policies assigned to staff's clinic
 */
router.get('/documents', requireStaff, async (req, res) => {
    try {
        // Get clinic_id from staff table if not in token
        let clinicId = req.user.clinicId;
        if (!clinicId) {
            const { data: staffData, error: staffError } = await supabaseAdmin
                .from('staff')
                .select('clinic_id')
                .eq('id', req.user.staffId)
                .single();

            if (staffError || !staffData) {
                console.error('Failed to get staff clinic:', staffError);
                return res.status(500).json({ error: 'Failed to get staff details' });
            }
            clinicId = staffData.clinic_id;
        }

        // Fetch documents from clinic_documents table (policies shared with employees)
        const { data: docs, error: docsError } = await supabaseAdmin
            .from('clinic_documents')
            .select('*')
            .eq('clinic_id', clinicId)
            .in('category', ['policy', 'license', 'contract']) // Only show relevant document types
            .order('created_at', { ascending: false });

        if (docsError) {
            console.error('Documents query error:', docsError);
            return res.status(500).json({ error: 'Failed to fetch documents' });
        }

        // Check acknowledgments for this staff member
        const docIds = (docs || []).map(d => d.id);
        let acknowledgments = [];

        if (docIds.length > 0) {
            const { data: acks } = await supabaseAdmin
                .from('clinic_document_acknowledgments')
                .select('document_id, acknowledged_at')
                .eq('staff_id', req.user.staffId)
                .in('document_id', docIds);

            acknowledgments = acks || [];
        }

        // Create a map for quick lookup
        const ackMap = {};
        acknowledgments.forEach(a => {
            ackMap[a.document_id] = a.acknowledged_at;
        });

        // Format documents with acknowledgment status
        const documents = (docs || []).map(doc => ({
            id: doc.id,
            name: doc.name,
            category: doc.category,
            file_name: doc.file_name,
            file_type: doc.file_type,
            file_size: doc.file_size,
            created_at: doc.created_at,
            acknowledged: !!ackMap[doc.id],
            acknowledged_at: ackMap[doc.id] || null
        }));

        res.json({ documents });
    } catch (err) {
        console.error('Get documents error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/employee/documents/:docId/acknowledge
 * Acknowledge a document/policy
 */
router.post('/documents/:docId/acknowledge', requireStaff, async (req, res) => {
    try {
        const { docId } = req.params;

        // Get clinic_id from staff table if not in token
        let clinicId = req.user.clinicId;
        if (!clinicId) {
            const { data: staffData } = await supabaseAdmin
                .from('staff')
                .select('clinic_id')
                .eq('id', req.user.staffId)
                .single();
            clinicId = staffData?.clinic_id;
        }

        // Check if document exists in clinic_documents
        const { data: doc } = await supabaseAdmin
            .from('clinic_documents')
            .select('*')
            .eq('id', docId)
            .eq('clinic_id', clinicId)
            .single();

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check if already acknowledged
        const { data: existing } = await supabaseAdmin
            .from('clinic_document_acknowledgments')
            .select('*')
            .eq('document_id', docId)
            .eq('staff_id', req.user.staffId)
            .maybeSingle();

        if (existing) {
            return res.json({ success: true, acknowledgment: existing });
        }

        // Create acknowledgment
        const { data, error } = await supabaseAdmin
            .from('clinic_document_acknowledgments')
            .insert({
                document_id: docId,
                staff_id: req.user.staffId,
                acknowledged_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Acknowledge insert error:', error);
            return res.status(500).json({ error: 'Failed to acknowledge document' });
        }

        res.json({ success: true, acknowledgment: data });
    } catch (err) {
        console.error('Acknowledge document error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/employee/documents/:docId/download
 * Get signed download URL for a document
 */
router.get('/documents/:docId/download', requireStaff, async (req, res) => {
    try {
        const { docId } = req.params;

        // Get clinic_id from staff table if not in token
        let clinicId = req.user.clinicId;
        if (!clinicId) {
            const { data: staffData } = await supabaseAdmin
                .from('staff')
                .select('clinic_id')
                .eq('id', req.user.staffId)
                .single();
            clinicId = staffData?.clinic_id;
        }

        // Get document
        const { data: doc, error: docError } = await supabaseAdmin
            .from('clinic_documents')
            .select('*')
            .eq('id', docId)
            .eq('clinic_id', clinicId)
            .single();

        if (docError || !doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Generate signed URL (valid for 1 hour)
        const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
            .from('clinic-documents')
            .createSignedUrl(doc.file_path, 3600);

        if (urlError) {
            console.error('Signed URL error:', urlError);
            return res.status(500).json({ error: 'Failed to generate download URL' });
        }

        res.json({
            success: true,
            downloadUrl: signedUrl.signedUrl,
            fileName: doc.file_name
        });
    } catch (err) {
        console.error('Download document error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

