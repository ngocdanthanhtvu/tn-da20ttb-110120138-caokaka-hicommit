const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const courseMiddleware = require('../middleware/courseMiddleware');
const {
    createCourse,
    getCourses,
    getMyCourses,
    getCourseByIdOrSlug,
    joinCourse,
    getJoinedCourses,
    getCourseByIDForAdmin,
    addMemberToCourse,
    addMultipleMembersToCourse,
    deleteMemberFromCourse,
    updateUnits,
    updateKey,
    togglePublishCourse,
    togglePublicCourse,
    updateCourse,
    deleteCourse,
    toggleAutoJoin
} = require('../controllers/courseController');
const { createUnit, getUnits, updateUnitById, deleteUnitById } = require('../controllers/unitController');

const { getCourseAnalysis, analysisSubmissionOfCourse, getProblemAnalysisOfCourse } = require('../controllers/analysis');

router.get('/list', getCourses);
router.get('/created', authMiddleware.authenticate, getMyCourses);
router.get('/joined', authMiddleware.authenticate, getJoinedCourses);
router.get('/admin/:id', authMiddleware.authenticate, courseMiddleware.canManageCourse, getCourseByIDForAdmin);
router.get('/:id/analysis/submissions', authMiddleware.authenticate, courseMiddleware.canManageCourse, analysisSubmissionOfCourse);
router.get('/:id/analysis/problems', authMiddleware.authenticate, courseMiddleware.canManageCourse, getProblemAnalysisOfCourse);
router.get('/:id/analysis', authMiddleware.authenticate, courseMiddleware.canManageCourse, getCourseAnalysis);
router.get('/:id', authMiddleware.authenticate, getCourseByIdOrSlug);
router.post('/create', authMiddleware.authenticate, authMiddleware.isAdminOrTeacher, createCourse);
router.post('/join/:id', authMiddleware.authenticate, joinCourse);
router.post('/:id/add-member', authMiddleware.authenticate, courseMiddleware.canManageCourse, addMemberToCourse);
router.post('/:id/add-multiple-members', authMiddleware.authenticate, courseMiddleware.canManageCourse, addMultipleMembersToCourse);
router.put('/:id/units', authMiddleware.authenticate, courseMiddleware.isAuthor, updateUnits);
router.put('/:id/key', authMiddleware.authenticate, courseMiddleware.isAuthor, updateKey);
router.put('/:id/publish', authMiddleware.authenticate, courseMiddleware.isAuthor, togglePublishCourse);
router.put('/:id/public', authMiddleware.authenticate, courseMiddleware.isAuthor, togglePublicCourse);
router.put('/:id/auto_join', authMiddleware.authenticate, courseMiddleware.isAuthor, toggleAutoJoin);
router.put('/:id', authMiddleware.authenticate, courseMiddleware.isAuthor, updateCourse);

router.get('/:course_id/units/list', authMiddleware.authenticate, courseMiddleware.canAccessCourseContent, getUnits);
router.post('/:course_id/units/create', authMiddleware.authenticate, courseMiddleware.canManageCourse, createUnit);
router.put('/:course_id/units/:unit_id', authMiddleware.authenticate, courseMiddleware.canManageCourse, updateUnitById);

router.delete('/:course_id/units/:unit_id', authMiddleware.authenticate, courseMiddleware.canManageCourse, deleteUnitById);
router.delete('/:id/delete-member', authMiddleware.authenticate, courseMiddleware.canManageCourse, deleteMemberFromCourse);
router.delete('/:id', authMiddleware.authenticate, courseMiddleware.isAuthor, deleteCourse);
module.exports = router;