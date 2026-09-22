const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');
const Submission = require('./submission');

const SubmissionProvenance = sequelize.define('SubmissionProvenance', {
    submission_id: {
        type: DataTypes.STRING(16),
        allowNull: false,
        primaryKey: true
    },
    github_run_id: {
        type: DataTypes.STRING(32),
        allowNull: false
    },
    github_run_attempt: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    commit_sha: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    workflow_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    execution_environment: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    architecture: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    runner_version: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    problem_version: {
        type: DataTypes.CHAR(64),
        allowNull: true
    },
    testset_version: {
        type: DataTypes.CHAR(64),
        allowNull: true
    }
}, {
    tableName: 'submission_provenance',
    charset: 'utf8mb4',
    collate: 'utf8mb4_vietnamese_ci'
});

SubmissionProvenance.belongsTo(Submission, {
    foreignKey: 'submission_id',
    targetKey: 'id'
});

module.exports = SubmissionProvenance;
