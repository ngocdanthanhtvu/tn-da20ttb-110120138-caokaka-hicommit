const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');
const Submission = require('./submission');

const SubmissionTestResult = sequelize.define('SubmissionTestResult', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    submission_id: {
        type: DataTypes.STRING(16),
        allowNull: false
    },
    testcase_id: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    testcase_version: {
        type: DataTypes.CHAR(64),
        allowNull: true
    },
    test_order: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    input: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    expected_output: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    actual_output: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('PASSED', 'FAILED', 'ERROR', 'TIMEOUT'),
        allowNull: false
    },
    exit_code: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    signal_number: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    stderr: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    duration_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    timeout_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'submission_test_results',
    charset: 'utf8mb4',
    collate: 'utf8mb4_vietnamese_ci',
    indexes: [
        {
            unique: true,
            fields: ['submission_id', 'testcase_id']
        }
    ]
});

SubmissionTestResult.belongsTo(Submission, {
    foreignKey: 'submission_id',
    targetKey: 'id'
});

module.exports = SubmissionTestResult;
