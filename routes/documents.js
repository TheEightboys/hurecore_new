/**
 * HURE Core - Document Management Routes
 * Handles clinic document uploads and management
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');

// ============================================
// GET /api/employer/:clinicId/documents
// List all documents for a clinic
// ============================================
router.get('/:clinicId/documents', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { category } = req.query;

        let query = supabaseAdmin
            .from('clinic_documents')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false });

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, documents: data || [] });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// POST /api/employer/:clinicId/documents
// Upload a new document
// ============================================
router.post('/:clinicId/documents', async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { name, fileName, fileData, fileType, fileSize, category, uploadedBy, uploadedByName } = req.body;

        if (!name || !fileName || !fileData) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, fileName, fileData'
            });
        }

        // Decode base64 file data
        const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate unique file path
        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${clinicId}/${timestamp}_${safeName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('clinic-documents')
            .upload(filePath, buffer, {
                contentType: fileType || 'application/octet-stream',
                upsert: false
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Save document metadata to database
        const { data: doc, error: dbError } = await supabaseAdmin
            .from('clinic_documents')
            .insert({
                clinic_id: clinicId,
                name: name,
                file_name: fileName,
                file_path: filePath,
                file_size: fileSize || buffer.length,
                file_type: fileType || 'application/octet-stream',
                category: category || 'other',
                uploaded_by: uploadedBy || null,
                uploaded_by_name: uploadedByName || 'Unknown'
            })
            .select()
            .single();

        if (dbError) {
            // Try to delete uploaded file if database insert fails
            await supabaseAdmin.storage.from('clinic-documents').remove([filePath]);
            throw dbError;
        }

        res.json({ success: true, document: doc });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /api/employer/:clinicId/documents/:id
// Get a single document details
// ============================================
router.get('/:clinicId/documents/:id', async (req, res) => {
    try {
        const { clinicId, id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('clinic_documents')
            .select('*')
            .eq('id', id)
            .eq('clinic_id', clinicId)
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({ success: true, document: data });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /api/employer/:clinicId/documents/:id/download
// Get a signed download URL for a document
// ============================================
router.get('/:clinicId/documents/:id/download', async (req, res) => {
    try {
        const { clinicId, id } = req.params;

        // Get document metadata
        const { data: doc, error: dbError } = await supabaseAdmin
            .from('clinic_documents')
            .select('*')
            .eq('id', id)
            .eq('clinic_id', clinicId)
            .single();

        if (dbError) throw dbError;
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // Generate signed URL (valid for 1 hour)
        const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
            .from('clinic-documents')
            .createSignedUrl(doc.file_path, 3600);

        if (urlError) throw urlError;

        res.json({
            success: true,
            downloadUrl: signedUrl.signedUrl,
            fileName: doc.file_name
        });
    } catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// DELETE /api/employer/:clinicId/documents/:id
// Delete a document
// ============================================
router.delete('/:clinicId/documents/:id', async (req, res) => {
    try {
        const { clinicId, id } = req.params;

        // Get document to find file path
        const { data: doc, error: fetchError } = await supabaseAdmin
            .from('clinic_documents')
            .select('file_path')
            .eq('id', id)
            .eq('clinic_id', clinicId)
            .single();

        if (fetchError) throw fetchError;
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // Delete from storage
        const { error: storageError } = await supabaseAdmin.storage
            .from('clinic-documents')
            .remove([doc.file_path]);

        if (storageError) {
            console.error('Storage delete error:', storageError);
            // Continue to delete from database even if storage delete fails
        }

        // Delete from database
        const { error: dbError } = await supabaseAdmin
            .from('clinic_documents')
            .delete()
            .eq('id', id)
            .eq('clinic_id', clinicId);

        if (dbError) throw dbError;

        res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
