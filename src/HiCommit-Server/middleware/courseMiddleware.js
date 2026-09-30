const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Course = require('../models/course');

// Middleware kiểm tra người dùng có phải là tác giả của khóa học không
exports.isAuthor = async (req, res, next) => {
    // Nếu là ADMIN thì không cần kiểm tra
    if (req.user.role === 'ADMIN') {
        return next();
    }

    try {
        // Tìm khóa học trong cơ sở dữ liệu bằng courseId
        const course = await Course.findByPk(req.params.id);

        // Kiểm tra xem khóa học có tồn tại không
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Kiểm tra xem người dùng có phải là tác giả của khóa học không
        if (req.user.id !== course.created_by) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    } catch (error) {
        console.error('Error checking author:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Chỉ ADMIN hoặc TEACHER sở hữu khóa học được truy cập chức năng quản lý/phân tích
exports.canManageCourse = async (req, res, next) => {
    try {
        if (req.user.role === 'ADMIN') {
            return next();
        }

        if (req.user.role !== 'TEACHER') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const courseIdentifier =
            req.params.course_id || req.params.id;

        let course = await Course.findByPk(courseIdentifier);

        if (!course) {
            course = await Course.findOne({
                where: { slug: courseIdentifier }
            });
        }

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (req.user.id !== course.created_by) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    } catch (error) {
        console.error('Error checking course manager:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Kiểm tra quyền truy cập nội dung khóa học
exports.canAccessCourseContent = async (req, res, next) => {
    try {
        const courseId = req.params.course_id || req.params.id;

        const course = await Course.findByPk(courseId);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (req.user.role === 'ADMIN') {
            return next();
        }

        if (
            req.user.role === 'TEACHER' &&
            req.user.id === course.created_by
        ) {
            return next();
        }

        const UserCourse = require('../models/user_course');

        const membership = await UserCourse.findOne({
            where: {
                email: req.user.email,
                course_id: course.id,
                status: 'ACTIVE'
            }
        });

        if (!membership) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    } catch (error) {
        console.error('Error checking course access:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
