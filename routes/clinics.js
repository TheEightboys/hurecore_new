/**
 * HURE Core - Clinics Routes
 * SuperAdmin clinic management endpoints
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../lib/supabase');
const { requireSuperAdmin, generateFirstLoginToken } = require('../lib/auth');
const { logAudit, AUDIT_TYPES } = require('../lib/audit');
const { sendActivationEmail, sendSuspensionEmail } = require('../lib/email');
const { getPlanDetails, checkPlanLimits } = require('../lib/plans');

/**
 * GET /api/clinics
 * List all clinics with optional filtering
 */
router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const { status, search, limit = 50, offset = 0 } = req.query;

        let query = supabaseAdmin
            .from('clinics')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Filter by status
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        // Search by name or email
        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: clinics, error, count } = await query;

        if (error) {
            console.error('List clinics error:', error);
            return res.status(500).json({ error: 'Failed to fetch clinics' });
        }

        // Get staff counts for all clinics
        const clinicIds = clinics.map(c => c.id);
        const { data: staffCounts } = await supabaseAdmin
            .from('staff')
            .select('clinic_id')
            .in('clinic_id', clinicIds);

        // Count staff per clinic
        const staffCountMap = {};
        if (staffCounts) {
            staffCounts.forEach(s => {
                staffCountMap[s.clinic_id] = (staffCountMap[s.clinic_id] || 0) + 1;
            });
        }

        // Add plan details and usage info
        const enrichedClinics = clinics.map(clinic => {
            const planDetails = getPlanDetails(clinic.plan_product, clinic.plan_key);
            const staffCount = staffCountMap[clinic.id] || 0;

            // Create a modified clinic object with the actual staff count
            const clinicWithCount = {
                ...clinic,
                staff_count: staffCount
            };

            const limits = planDetails ? checkPlanLimits(clinicWithCount, planDetails) : null;

            return {
                ...clinicWithCount,
                planDetails,
                limits
            };
        });

        res.json({
            clinics: enrichedClinics,
            total: count,
            limit,
            offset
        });

    } catch (err) {
        console.error('List clinics error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/clinics/:id
 * Get single clinic details
 */
router.get('/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: clinic, error } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const planDetails = getPlanDetails(clinic.plan_product, clinic.plan_key);
        const limits = planDetails ? checkPlanLimits(clinic, planDetails) : null;

        res.json({
            clinic: {
                ...clinic,
                planDetails,
                limits
            }
        });

    } catch (err) {
        console.error('Get clinic error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:id/activate
 * Activate a pending clinic
 */
router.patch('/:id/activate', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Get clinic
        const { data: clinic, error: fetchError } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        if (clinic.status === 'active') {
            return res.status(400).json({ error: 'Clinic already active' });
        }

        // Generate first login token
        const firstLoginToken = generateFirstLoginToken(id, clinic.email);
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Update clinic status
        const { error: updateError } = await supabaseAdmin
            .from('clinics')
            .update({
                status: 'active',
                activated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to activate clinic' });
        }

        // Update user with first login token
        await supabaseAdmin
            .from('users')
            .update({
                first_login_token: firstLoginToken,
                first_login_token_expires: tokenExpires.toISOString()
            })
            .eq('clinic_id', id)
            .eq('role', 'owner');

        // Update subscription status
        await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('clinic_id', id);

        // Send activation email
        const firstLoginUrl = `${process.env.APP_URL || 'https://core.gethure.com'}/first-login?token=${firstLoginToken}`;
        await sendActivationEmail(clinic.email, clinic.name, firstLoginUrl);

        // Log audit
        await logAudit(
            AUDIT_TYPES.CLINIC_ACTIVATED,
            req.user,
            { entity: 'clinic', id: clinic.id, name: clinic.name }
        );

        res.json({
            success: true,
            message: 'Clinic activated successfully',
            firstLoginUrl
        });

    } catch (err) {
        console.error('Activate clinic error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:id/suspend
 * Suspend a clinic
 */
router.patch('/:id/suspend', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Get clinic
        const { data: clinic, error: fetchError } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Update status
        const { error: updateError } = await supabaseAdmin
            .from('clinics')
            .update({
                status: 'suspended',
                suspend_reason: reason || null
            })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to suspend clinic' });
        }

        // Update subscription
        await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'paused' })
            .eq('clinic_id', id);

        // Send suspension email
        await sendSuspensionEmail(clinic.email, clinic.name, reason);

        // Log audit
        await logAudit(
            AUDIT_TYPES.CLINIC_SUSPENDED,
            req.user,
            { entity: 'clinic', id: clinic.id, name: clinic.name },
            {},
            reason
        );

        res.json({
            success: true,
            message: 'Clinic suspended'
        });

    } catch (err) {
        console.error('Suspend clinic error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:id/reject
 * Reject a pending clinic
 */
router.patch('/:id/reject', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Get clinic
        const { data: clinic, error: fetchError } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Update status
        const { error: updateError } = await supabaseAdmin
            .from('clinics')
            .update({
                status: 'rejected',
                reject_reason: reason || null
            })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to reject clinic' });
        }

        // Log audit
        await logAudit(
            AUDIT_TYPES.CLINIC_REJECTED,
            req.user,
            { entity: 'clinic', id: clinic.id, name: clinic.name },
            {},
            reason
        );

        res.json({
            success: true,
            message: 'Clinic rejected'
        });

    } catch (err) {
        console.error('Reject clinic error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/clinics/:id/change-plan
 * Change clinic plan
 */
router.patch('/:id/change-plan', requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { planKey, planProduct, modules } = req.body;

        if (!planKey) {
            return res.status(400).json({ error: 'Plan key required' });
        }

        // Get clinic
        const { data: clinic, error: fetchError } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const isBundle = modules ? modules.includes('core') && modules.includes('care') : clinic.is_bundle;

        // Update clinic
        const { error: updateError } = await supabaseAdmin
            .from('clinics')
            .update({
                plan_key: planKey,
                plan_product: planProduct || clinic.plan_product,
                modules: modules || clinic.modules,
                is_bundle: isBundle
            })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to change plan' });
        }

        // Log audit
        await logAudit(
            AUDIT_TYPES.CLINIC_PLAN_CHANGED,
            req.user,
            { entity: 'clinic', id: clinic.id, name: clinic.name },
            { oldPlan: clinic.plan_key, newPlan: planKey, modules }
        );

        res.json({
            success: true,
            message: 'Plan changed successfully'
        });

    } catch (err) {
        console.error('Change plan error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/clinics/stats/overview
 * Dashboard metrics
 */
router.get('/stats/overview', requireSuperAdmin, async (req, res) => {
    try {
        // Get counts by status
        const { data: clinics } = await supabaseAdmin
            .from('clinics')
            .select('status, is_bundle, modules');

        const stats = {
            total: clinics.length,
            pending: clinics.filter(c => c.status.startsWith('pending')).length,
            active: clinics.filter(c => c.status === 'active').length,
            suspended: clinics.filter(c => c.status === 'suspended').length,
            bundles: clinics.filter(c => c.is_bundle).length,
            coreOnly: clinics.filter(c => c.modules.length === 1 && c.modules[0] === 'core').length,
            careOnly: clinics.filter(c => c.modules.length === 1 && c.modules[0] === 'care').length
        };

        res.json(stats);

    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
