const Submission = require('../models/submission');
const Testcase = require('../models/testcase');
const Problem = require('../models/problem');
const User = require('../models/user');
const Course = require('../models/course');
const Unit = require('../models/unit');
const Contest = require('../models/contest');
const SubmissionCompileResult = require('../models/submissionCompileResult');

// Submission(id, problem_slug, user_id, sha, commit, run_id, code, status, duration, result, style_check, pass_count, total_count)
// Testcase(id, input, output, sugestion)
// Contest(id, created_by, name, description, start_time, end_time, duration, problems, publish, public, join_key, slug, pinned)

const getMySubmissions = async (req, res) => {
    try {
        const submissions = await Submission.findAll({
            where: {
                username: req.user.username
            },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json(submissions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const getSubmissionsByProblem = async (req, res) => {
    try {
        const problem = await Problem.findOne({
            where: {
                slug: req.params.problem_slug
            }
        });

        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }

        let canViewAll = req.user.role === 'ADMIN';

        if (req.user.role === 'TEACHER' && problem.type === 'COURSE') {
            const course = await Course.findByPk(problem.parent, {
                attributes: ['id', 'created_by']
            });

            canViewAll = !!course && course.created_by === req.user.id;
        }

        const where = {
            problem_slug: req.params.problem_slug
        };

        if (!canViewAll) {
            where.username = req.user.username;
        }

        const submissions = await Submission.findAll({
            where,
            attributes: ['username', 'status'],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json(submissions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const getMySubmissionsByProblem = async (req, res) => {
    try {
        const submissions = await Submission.findAll({
            where: {
                username: req.user.username,
                problem_slug: req.params.problem_slug
            },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json(submissions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


const getSubmissionById = async (req, res) => {
    try {
        const submission = await Submission.findOne({
            where: {
                id: req.params.id
            }
        });

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Lấy thông tin actor từ username
        const user = await User.findOne({
            where: {
                username: submission.username
            },
            attributes: ['id', 'username', 'avatar_url']
        });

        // Lấy ra thông tin problem từ problem_slug
        const problem = await Problem.findOne({
            where: {
                slug: submission.problem_slug
            }
        });

        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }

        // Xác định quyền xem submission
        const isOwner = submission.username === req.user.username;
        const isAdmin = req.user.role === 'ADMIN';
        let isCourseTeacher = false;

        // Tạo một bản sao đối tượng problem để thao tác
        let problemData = problem.toJSON();

        // Nếu là bài tập trong khóa học thì kiểm tra teacher có phải chủ khóa học không
        if (problem.type === 'COURSE') {
            const course = await Course.findByPk(problem.parent, {
                attributes: ['id', 'name', 'slug', 'created_by'],
            });

            if (!course) {
                return res.status(404).json({ error: 'Course not found' });
            }

            isCourseTeacher =
                req.user.role === 'TEACHER' &&
                req.user.id === course.created_by;

            problemData.parent = {
                id: course.id,
                name: course.name,
                slug: course.slug
            };
        }

        const canViewFull = isOwner || isAdmin || isCourseTeacher;

        if (!canViewFull && !submission.public) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        problemData.testcase_count = problemData.testcases.length;

        // Xoá testcases để tránh lộ thông tin
        delete problemData.testcases;

        // Duyệt qua mảng result của submission để thêm thông tin testcase
        const testcases = [];
        for (let i = 0; i < submission.result.length; i++) {
            const testcase = await Testcase.findOne({
                where: {
                    id: submission.result[i].id
                }
            });

            testcases.push({
                id: testcase.id,
                input: testcase.input,
                output: testcase.output,
                suggestion: testcase.suggestion,
                status: submission.result[i].status,
                duration: submission.result[i].duration,
                actual_output: submission.result[i].actual_output
            });
        }

        const compileResult = await SubmissionCompileResult.findOne({
            where: {
                submission_id: submission.id
            }
        });

        submission.dataValues.problem = problemData;
        submission.dataValues.actor = user;

        if (canViewFull) {
            submission.dataValues.testcases = testcases;
            submission.dataValues.compile_result = compileResult;

            return res.status(200).json(submission);
        }

        // Public viewer: chỉ công khai mã nguồn và metadata cơ bản
        return res.status(200).json({
            id: submission.id,
            problem_slug: submission.problem_slug,
            code: submission.code,
            public: submission.public,
            status: submission.status,
            createdAt: submission.createdAt,
            problem: problemData,
            actor: user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Lấy danh sách các bài tập (slug) đã nộp của mình (theo username)
// Các Level Status: PASS > FAIL > ERROR > COMPILE_ERROR > PENDING
const getMySubmissionsResult = async (req, res) => {
    try {
        const submissions = await Submission.findAll({
            where: {
                username: req.user.username
            },
            order: [['createdAt', 'DESC']]
        });

        const statusPriority = {
            'PASSED': 4,
            'FAILED': 3,
            'ERROR': 2,
            'COMPILE_ERROR': 1,
            'PENDING': 0
        };

        const resultMap = {};

        submissions.forEach(submission => {
            const currentStatus = submission.status;
            const problemSlug = submission.problem_slug;

            if (!resultMap[problemSlug] || statusPriority[currentStatus] > statusPriority[resultMap[problemSlug]]) {
                resultMap[problemSlug] = currentStatus;
            }
        });

        res.status(200).json(resultMap);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const togglePublicCode = async (req, res) => {
    try {
        const submission = await Submission.findByPk(req.params.id);

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        if (
            req.user.role !== 'ADMIN' &&
            submission.username !== req.user.username
        ) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        submission.public = !submission.public;
        await submission.save();

        res.status(200).json(submission);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getMySubmissions,
    getSubmissionsByProblem,
    getMySubmissionsByProblem,
    getSubmissionById,
    getMySubmissionsResult,
    togglePublicCode
};