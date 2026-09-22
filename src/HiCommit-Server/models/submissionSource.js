const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');
const Submission = require('./submission');

const SubmissionSource = sequelize.define('SubmissionSource', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    submission_id: {
        type: DataTypes.STRING(16),
        allowNull: false
    },
    path: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    language: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    encoding: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'utf-8'
    },
    content_base64: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    sha256: {
        type: DataTypes.CHAR(64),
        allowNull: false
    },
    size_bytes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    line_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    }
}, {
    tableName: 'submission_sources',
    charset: 'utf8mb4',
    collate: 'utf8mb4_vietnamese_ci',
    indexes: [
        {
            unique: true,
            fields: ['submission_id', 'path']
        }
    ]
});

SubmissionSource.belongsTo(Submission, {
    foreignKey: 'submission_id',
    targetKey: 'id'
});

module.exports = SubmissionSource;
