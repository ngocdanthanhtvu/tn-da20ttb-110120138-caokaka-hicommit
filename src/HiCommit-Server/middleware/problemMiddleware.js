const Problem = require('../models/problem');
const Course = require('../models/course');
const Contest = require('../models/contest');

exports.canManageProblem = async (req, res, next) => {
    try {
        if (req.user.role === 'ADMIN') {
            return next();
        }

        if (req.user.role !== 'TEACHER') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        let problem = await Problem.findByPk(req.params.id);

        if (!problem) {
            problem = await Problem.findOne({
                where: { slug: req.params.id }
            });
        }

        if (!problem) {
            return res.status(404).json({
                error: 'Problem not found'
            });
        }

        // TEACHER chỉ quản lý problem do chính mình tạo
        if (problem.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Problem thuộc COURSE: teacher phải sở hữu course cha
        if (problem.type === 'COURSE') {
            const course = await Course.findByPk(problem.parent);

            if (!course) {
                return res.status(404).json({
                    error: 'Course not found'
                });
            }

            if (course.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        // Problem thuộc CONTEST: teacher phải sở hữu contest cha
        if (problem.type === 'CONTEST') {
            const contest = await Contest.findByPk(problem.parent);

            if (!contest) {
                return res.status(404).json({
                    error: 'Contest not found'
                });
            }

            if (contest.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        next();
    } catch (error) {
        console.error('Error checking problem manager:', error);
        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
};
