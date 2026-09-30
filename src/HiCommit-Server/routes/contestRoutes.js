const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const contestMiddleware = require('../middleware/contestMiddleware');

const {
    getContests,
    getContestByID,
    getContestDescriptionByID,
    createContest,
    joinContest,
    getJoinedContest,
    exitContest,
    getProblemsByContestID,
    getMembersByContestID,
    getSubmissionsByContestID
} = require('../controllers/contestController');

const e = require('cors');

router.get('/list', getContests);
router.get('/joined', authMiddleware.authenticate, getJoinedContest);
router.get('/:id/submissions', authMiddleware.authenticate, contestMiddleware.canAccessContestContent, getSubmissionsByContestID);
router.get('/:id/description', authMiddleware.authenticate, getContestDescriptionByID);
router.get('/:id/problems', authMiddleware.authenticate, contestMiddleware.canAccessContestContent, getProblemsByContestID);
router.get('/:id/members', authMiddleware.authenticate, contestMiddleware.canAccessContestContent, getMembersByContestID);
router.get('/:id', authMiddleware.authenticate, getContestByID);
router.post('/:id/join', authMiddleware.authenticate, joinContest);

router.post('/:id/exit', authMiddleware.authenticate, exitContest);

module.exports = router;