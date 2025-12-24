/**
 * HURE Core - Clinic Settings API
 * Manages clinic profile, attendance, and leave policy settings
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');

/**
 * GET /api/clinics/:clinicId/settings
 * Get all clinic settings
 */
router.get('/:clinicId/settings', async (req, res) => {
    try {
        const { clinicId } = req.params;

        // Get clinic profile
        const { data: clinic, error: clinicError } = await supabaseAdmin
            .from('clinics')
            .select('id, name, town, email, phone, contact_name, status')
            .eq('id', clinicId)
            .single();

        if (clinicError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Get or create clinic settings
        let { data: settings, error: settingsError } = await supabaseAdmin
            .from('clinic_settings')
            .select('*')
            .eq('clinic_id', clinicId)
            .maybeSingle();

        // If no settings exist, create default settings
        if (!settings) {
            const { data: newSettings, error: createError } = await supabaseAdmin
                .from('clinic_settings')
                .insert({ clinic_id: clinicId })
                .select()
                .single();

            if (createError) {
                console.error('Failed to create default settings:', createError);
                // Return defaults if can't create
                settings = {
                    required_daily_hours: 8,
                    unpaid_break_minutes: 30,
                    late_threshold_minutes: 15,
                    overtime_multiplier: 1.5,
                    annual_leave_days: 21,
                    sick_leave_days: 10,
                    maternity_leave_days: 90,
                    paternity_leave_days: 14,
                    leave_carryover_allowed: false,
                    business_hours: {
                        monday: { open: "08:00", close: "17:00", closed: false },
                        tuesday: { open: "08:00", close: "17:00", closed: false },
                        wednesday: { open: "08:00", close: "17:00", closed: false },
                        thursday: { open: "08:00", close: "17:00", closed: false },
                        friday: { open: "08:00", close: "17:00", closed: false },
                        saturday: { open: "09:00", close: "13:00", closed: false },
                        sunday: { open: null, close: null, closed: true }
                    }
                };
            } else {
                settings = newSettings;
            }
        }

        res.json({
            clinic,
            settings: {
                attendance: {
                    required_daily_hours: settings.required_daily_hours,
                    unpaid_break_minutes: settings.unpaid_break_minutes,
                    late_threshold_minutes: settings.late_threshold_minutes,
                    overtime_multiplier: settings.overtime_multiplier
                },
                leave: {
                    annual_leave_days: settings.annual_leave_days,
                    sick_leave_days: settings.sick_leave_days,
                    maternity_leave_days: settings.maternity_leave_days,
                    paternity_leave_days: settings.paternity_leave_days,
                    leave_carryover_allowed: settings.leave_carryover_allowed
                },
                business_hours: settings.business_hours
            }
        });
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:clinicId/settings
 * Update clinic settings
 */
router.patch('/:clinicId/settings', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { clinic: clinicUpdates, attendance, leave, business_hours } = req.body;

        // Update clinic profile if provided
        if (clinicUpdates) {
            const { error: clinicError } = await supabaseAdmin
                .from('clinics')
                .update({
                    name: clinicUpdates.name,
                    town: clinicUpdates.town,
                    phone: clinicUpdates.phone,
                    contact_name: clinicUpdates.contact_name,
                    updated_at: new Date().toISOString()
                })
                .eq('id', clinicId);

            if (clinicError) {
                console.error('Clinic update error:', clinicError);
                return res.status(500).json({ error: 'Failed to update clinic profile' });
            }
        }

        // Build settings update object
        const settingsUpdate = {};

        if (attendance) {
            if (attendance.required_daily_hours !== undefined)
                settingsUpdate.required_daily_hours = attendance.required_daily_hours;
            if (attendance.unpaid_break_minutes !== undefined)
                settingsUpdate.unpaid_break_minutes = attendance.unpaid_break_minutes;
            if (attendance.late_threshold_minutes !== undefined)
                settingsUpdate.late_threshold_minutes = attendance.late_threshold_minutes;
            if (attendance.overtime_multiplier !== undefined)
                settingsUpdate.overtime_multiplier = attendance.overtime_multiplier;
        }

        if (leave) {
            if (leave.annual_leave_days !== undefined)
                settingsUpdate.annual_leave_days = leave.annual_leave_days;
            if (leave.sick_leave_days !== undefined)
                settingsUpdate.sick_leave_days = leave.sick_leave_days;
            if (leave.maternity_leave_days !== undefined)
                settingsUpdate.maternity_leave_days = leave.maternity_leave_days;
            if (leave.paternity_leave_days !== undefined)
                settingsUpdate.paternity_leave_days = leave.paternity_leave_days;
            if (leave.leave_carryover_allowed !== undefined)
                settingsUpdate.leave_carryover_allowed = leave.leave_carryover_allowed;
        }

        if (business_hours) {
            settingsUpdate.business_hours = business_hours;
        }

        // Update settings if there are any changes
        if (Object.keys(settingsUpdate).length > 0) {
            settingsUpdate.updated_at = new Date().toISOString();

            const { error: settingsError } = await supabaseAdmin
                .from('clinic_settings')
                .upsert({
                    clinic_id: clinicId,
                    ...settingsUpdate
                }, { onConflict: 'clinic_id' });

            if (settingsError) {
                console.error('Settings update error:', settingsError);
                return res.status(500).json({ error: 'Failed to update settings' });
            }
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
