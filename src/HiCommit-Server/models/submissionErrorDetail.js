const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');
const Submission = require('./submission');

const SubmissionErrorDetail = sequelize.define('SubmissionErrorDetail', {
    submission_id: {
        type: DataTypes.STRING(16),
        allowNull: false,
        primaryKey: true
    },
    error_type: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    error_stage: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    message: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    }
}, {
    tableName: 'submission_error_details',
    charset: 'utf8mb4',
    collate: 'utf8mb4_vietnamese_ci'
});

SubmissionErrorDetail.belongsTo(Submission, {
    foreignKey: 'submission_id',
    targetKey: 'id'
});

module.exports = SubmissionErrorDetail;
