const Contest = require('../models/contest');
const UserContest = require('../models/user_contest');

exports.canAccessContestContent = async (req, res, next) => {
    try {
        const contest = await Contest.findByPk(req.params.id);

        if (!contest) {
            return res.status(404).json({
                message: 'Contest not found'
            });
        }

        // ADMIN có quyền truy cập toàn bộ contest
        if (req.user.role === 'ADMIN') {
            return next();
        }

        // Người tạo contest được truy cập
        if (req.user.id === contest.created_by) {
            return next();
        }

        // Người tham gia phải còn trạng thái ACTIVE
        const membership = await UserContest.findOne({
            where: {
                contest_id: contest.id,
                user_id: req.user.id,
                status: 'ACTIVE'
            }
        });

        if (!membership) {
            return res.status(403).json({
                message: 'Bạn không có quyền truy cập nội dung cuộc thi này'
            });
        }

        next();
    } catch (error) {
        console.error('Error checking contest access:', error);
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    }
};
