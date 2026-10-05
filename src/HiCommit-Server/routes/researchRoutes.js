const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const {
    previewResearchExport,
    downloadResearchExport
} = require('../controllers/researchController');

router.post(
    '/export/preview',
    authMiddleware.authenticate,
    authMiddleware.isAdminOrTeacher,
    previewResearchExport
);

router.post(
    '/export/download',
    authMiddleware.authenticate,
    authMiddleware.isAdminOrTeacher,
    downloadResearchExport
);

module.exports = router;
