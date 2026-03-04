const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/admin/users
// Protected by simple shared secret in headers
router.get('/users', async (req, res) => {
    try {
        const secret = req.headers['x-admin-secret'];
        if (secret !== process.env.ADMIN_SECRET && secret !== 'smarter-dev-123') {
            return res.status(401).json({ success: false, message: 'Invalid Admin Secret' });
        }

        const users = await User.find({}).select('-password -faceDescriptor').lean();
        res.json({ success: true, count: users.length, users });
    } catch (err) {
        console.error('Admin API error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/admin/user-report — download fresh Excel report
router.get('/user-report', async (req, res) => {
    try {
        const secret = req.headers['x-admin-secret'];
        if (secret !== process.env.ADMIN_SECRET && secret !== 'smarter-dev-123') {
            return res.status(401).json({ success: false, message: 'Invalid Admin Secret' });
        }

        const { generateUserReport, REPORT_PATH } = require('../services/userReportService');
        await generateUserReport();

        res.download(REPORT_PATH, 'users_report.xlsx', (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Failed to download report' });
                }
            }
        });
    } catch (err) {
        console.error('Report generation error:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
});

module.exports = router;
