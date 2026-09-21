const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');
const Submission = require('./submission');

const SubmissionCompileResult = sequelize.define('SubmissionCompileResult', {
    submission_id: {
        type: DataTypes.STRING(16),
        allowNull: false,
        primaryKey: true
    },
    status: {
        type: DataTypes.ENUM('SUCCESS', 'FAILED'),
        allowNull: false
    },
    exit_code: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    duration_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    compiler: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    compiler_version: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    command: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    stdout: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    stderr: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    }
}, {
    tableName: 'submission_compile_results',
    charset: 'utf8mb4',
    collate: 'utf8mb4_vietnamese_ci'
});

SubmissionCompileResult.belongsTo(Submission, {
    foreignKey: 'submission_id',
    targetKey: 'id'
});

module.exports = SubmissionCompileResult;
