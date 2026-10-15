const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');
module.exports = sequelize.define('SubmissionCallback', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    run_id: { type: DataTypes.STRING(16), allowNull: false },
    run_attempt: { type: DataTypes.INTEGER, allowNull: false },
    phase: { type: DataTypes.STRING(8), allowNull: false },
    digest: { type: DataTypes.CHAR(64), allowNull: false },
    payload: { type: DataTypes.TEXT('long'), allowNull: false }
}, {
    tableName: 'submission_callbacks',
    indexes: [{ unique: true, fields: ['run_id', 'run_attempt', 'phase'] }]
});
